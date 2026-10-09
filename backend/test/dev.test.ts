import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createPgliteDb } from '../src/db/client.js';
import { migrate } from '../src/db/migrate.js';
import { createMemoryKv } from '../src/kv.js';
import { createMemoryMailer } from '../src/mailer.js';
import { createTokenService } from '../src/security/tokens.js';
import { createTestContext } from './helpers.js';

describe('development sign-in (npm run dev:test)', () => {
  it('does not exist on a server started normally', async () => {
    const ctx = await createTestContext();
    expect((await ctx.post('/v1/dev/login', {})).status).toBe(404);
    await ctx.close();
  });

  it('cannot be enabled in production, in tests or on a public address', () => {
    const on = { DEV_AUTO_LOGIN: 'true' };
    expect(() => loadConfig({ ...on, NODE_ENV: 'test' })).toThrow(/DEV_AUTO_LOGIN/);
    expect(() => loadConfig({ ...on, NODE_ENV: 'production' })).toThrow(/DEV_AUTO_LOGIN/);
    expect(() => loadConfig({ ...on, NODE_ENV: 'development', HOST: '0.0.0.0' })).toThrow(
      /DEV_AUTO_LOGIN/,
    );
  });

  it('opens an admin session without an account when enabled', async () => {
    const config = loadConfig({ NODE_ENV: 'development', DEV_AUTO_LOGIN: 'true' });
    const db = createPgliteDb();
    await migrate(db);
    const app = await buildApp({
      config,
      db,
      kv: createMemoryKv(),
      mailer: createMemoryMailer(),
      tokens: createTokenService({
        issuer: config.JWT_ISSUER,
        ttlSec: config.ACCESS_TOKEN_TTL_SEC,
      }),
      oauth: {},
    });
    app.log.level = 'silent';

    const login = await app.inject({ method: 'POST', url: '/v1/dev/login' });
    expect(login.statusCode).toBe(200);
    const me = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: `Bearer ${login.json().accessToken}` },
    });
    expect(me.json()).toMatchObject({ email: 'admin@dev.local', role: 'admin' });

    // Asking twice reuses the same account, and the website gets its cookie.
    const web = await app.inject({
      method: 'POST',
      url: '/v1/dev/login',
      headers: { 'content-type': 'application/json' },
      payload: { web: true },
    });
    expect(web.json().refreshToken).toBeUndefined();
    expect(web.cookies.find((c) => c.name === 'rt')).toBeDefined();
    const { rows } = await db.query('select id from users');
    expect(rows).toHaveLength(1);

    await app.close();
    await db.close();
  });
});
