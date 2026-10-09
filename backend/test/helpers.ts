import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createPgliteDb, type Db } from '../src/db/client.js';
import { migrate } from '../src/db/migrate.js';
import { createMemoryKv } from '../src/kv.js';
import { createMemoryMailer, type Mail } from '../src/mailer.js';
import type { OAuthProfile, OAuthProvider } from '../src/modules/auth/oauth.js';
import { createTokenService, type TokenService } from '../src/security/tokens.js';

export const PASSWORD = 'correct horse battery';

// Response bodies are asserted loosely in tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Res = { status: number; body: any };

export interface TestContext {
  app: FastifyInstance;
  db: Db;
  outbox: Mail[];
  tokens: TokenService;
  oauthProfiles: Map<string, OAuthProfile>;
  post(url: string, body?: unknown, token?: string): Promise<Res>;
  get(url: string, token?: string): Promise<Res>;
  del(url: string, token?: string): Promise<Res>;
  /** Registers, verifies and logs in a user. */
  signUp(email: string): Promise<{ accessToken: string; refreshToken: string; userId: string }>;
  close(): Promise<void>;
}

function tokenFromMail(mail: Mail | undefined): string {
  return new URL(mail!.data.url!).searchParams.get('token')!;
}

export function lastMailToken(ctx: TestContext, template: Mail['template']): string {
  return tokenFromMail(ctx.outbox.filter((m) => m.template === template).at(-1));
}

export async function createTestContext(): Promise<TestContext> {
  const config = loadConfig({ NODE_ENV: 'test' });
  const db = createPgliteDb();
  await migrate(db);
  const mailer = createMemoryMailer();
  const tokens = createTokenService({
    issuer: config.JWT_ISSUER,
    ttlSec: config.ACCESS_TOKEN_TTL_SEC,
  });
  // Stands in for Google and Discord: a test registers the profile a given code resolves to.
  const oauthProfiles = new Map<string, OAuthProfile>();
  const fakeProvider: OAuthProvider = {
    authorizeUrl: ({ state, redirectUri, codeChallenge }) =>
      `https://provider.test/authorize?${new URLSearchParams({ state, redirect_uri: redirectUri, code_challenge: codeChallenge })}`,
    async fetchProfile({ code }) {
      const profile = oauthProfiles.get(code);
      if (!profile) throw new Error('unknown code');
      return profile;
    },
  };
  const app = await buildApp({
    config,
    db,
    kv: createMemoryKv(),
    mailer,
    tokens,
    oauth: { google: fakeProvider, discord: fakeProvider },
  });

  const call = async (
    method: 'GET' | 'POST' | 'DELETE',
    url: string,
    body?: unknown,
    token?: string,
  ) => {
    const res = await app.inject({
      method,
      url,
      payload: body as object | undefined,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    return { status: res.statusCode, body: res.body ? res.json() : undefined };
  };

  const ctx: TestContext = {
    app,
    db,
    outbox: mailer.outbox,
    tokens,
    oauthProfiles,
    post: (url, body, token) => call('POST', url, body, token),
    get: (url, token) => call('GET', url, undefined, token),
    del: (url, token) => call('DELETE', url, undefined, token),
    async signUp(email) {
      await ctx.post('/v1/auth/register', { email, password: PASSWORD });
      await ctx.post('/v1/auth/verify-email', { token: lastMailToken(ctx, 'verify_email') });
      const login = await ctx.post('/v1/auth/login', {
        email,
        password: PASSWORD,
        deviceName: 'PC',
      });
      const me = await ctx.get('/v1/me', login.body.accessToken);
      return { ...login.body, userId: me.body.id };
    },
    async close() {
      await app.close();
      await db.close();
    },
  };
  return ctx;
}
