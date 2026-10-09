import { createHash, randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, lastMailToken, PASSWORD, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});
afterEach(() => ctx.close());

const WEB = 'http://localhost:3000';
const get = (url: string) => ctx.app.inject({ method: 'GET', url });

/** Starts a flow and returns the state the provider would echo back. */
async function start(query: string, provider = 'google') {
  const res = await get(`/v1/auth/oauth/${provider}/start?${query}`);
  return { res, state: new URL(res.headers.location as string).searchParams.get('state')! };
}

/** Runs a whole web sign-in for the given provider-side profile. */
async function webSignIn(
  profile: { id: string; email: string; verified?: boolean },
  provider = 'google',
) {
  ctx.oauthProfiles.set('code-' + profile.id, {
    providerUserId: profile.id,
    email: profile.email,
    emailVerified: profile.verified ?? true,
  });
  const { state } = await start('client=web', provider);
  return get(`/v1/auth/oauth/${provider}/callback?state=${state}&code=code-${profile.id}`);
}

const userByEmail = async (email: string) =>
  (
    await ctx.db.query<{
      id: string;
      password_hash: string | null;
      email_verified_at: Date | null;
    }>('select id, password_hash, email_verified_at from users where email = $1', [email])
  ).rows[0];

describe('sign-in with Google or Discord (website)', () => {
  it('lists the configured providers and rejects unknown ones', async () => {
    expect((await get('/v1/auth/oauth/providers')).json().providers).toEqual(['google', 'discord']);
    expect((await get('/v1/auth/oauth/facebook/start?client=web')).statusCode).toBe(404);
  });

  it('sends the browser to the provider with a state and a PKCE challenge', async () => {
    const { res } = await start('client=web');
    const url = new URL(res.headers.location as string);
    expect(res.statusCode).toBe(302);
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:4000/v1/auth/oauth/google/callback',
    );
  });

  it('creates a verified, password-less account and opens a cookie session', async () => {
    const res = await webSignIn({ id: 'g-1', email: 'New.User@Example.com' });
    expect(res.headers.location).toBe(`${WEB}/account/`);
    const cookie = res.cookies.find((c) => c.name === 'rt')!;
    expect(cookie.httpOnly).toBe(true);

    const user = await userByEmail('new.user@example.com');
    expect(user).toMatchObject({ password_hash: null });
    expect(user!.email_verified_at).toBeInstanceOf(Date);

    const refreshed = await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: { 'content-type': 'application/json' },
      payload: {},
      cookies: { rt: cookie.value },
    });
    const me = await ctx.get('/v1/me', refreshed.json().accessToken);
    expect(me.body.email).toBe('new.user@example.com');
  });

  it('returns to the same account on the next sign-in, even from the other provider', async () => {
    await webSignIn({ id: 'g-1', email: 'a@example.com' });
    await webSignIn({ id: 'g-1', email: 'a@example.com' });
    await webSignIn({ id: 'd-9', email: 'a@example.com' }, 'discord');
    expect((await ctx.db.query('select 1 from users')).rows).toHaveLength(1);
    expect((await ctx.db.query('select 1 from oauth_identities')).rows).toHaveLength(2);
  });

  it('refuses a provider email that the provider has not verified', async () => {
    const res = await webSignIn(
      { id: 'd-1', email: 'victim@example.com', verified: false },
      'discord',
    );
    expect(res.headers.location).toBe(`${WEB}/login/?error=oauth_email_not_verified`);
    expect(await userByEmail('victim@example.com')).toBeUndefined();
  });

  it('links to an existing verified account without touching its password', async () => {
    const existing = await ctx.signUp('a@example.com');
    await webSignIn({ id: 'g-1', email: 'a@example.com' });
    expect((await userByEmail('a@example.com'))!.id).toBe(existing.userId);
    const login = await ctx.post('/v1/auth/login', { email: 'a@example.com', password: PASSWORD });
    expect(login.status).toBe(200);
  });

  it('discards a password planted on an unverified account before the real owner arrives', async () => {
    // An attacker registers the victim's address with a password they know, and never verifies it.
    await ctx.post('/v1/auth/register', { email: 'victim@example.com', password: PASSWORD });
    const planted = lastMailToken(ctx, 'verify_email');

    await webSignIn({ id: 'g-victim', email: 'victim@example.com' });

    expect((await userByEmail('victim@example.com'))!.password_hash).toBeNull();
    const attacker = await ctx.post('/v1/auth/login', {
      email: 'victim@example.com',
      password: PASSWORD,
    });
    expect(attacker.status).toBe(401);
    expect(planted).toBeTruthy();
  });

  it('accepts a state only once and rejects made-up ones', async () => {
    ctx.oauthProfiles.set('c', {
      providerUserId: 'g-1',
      email: 'a@example.com',
      emailVerified: true,
    });
    const { state } = await start('client=web');
    const first = await get(`/v1/auth/oauth/google/callback?state=${state}&code=c`);
    const replay = await get(`/v1/auth/oauth/google/callback?state=${state}&code=c`);
    const forged = await get('/v1/auth/oauth/google/callback?state=made-up&code=c');
    expect(first.headers.location).toBe(`${WEB}/account/`);
    expect(replay.headers.location).toBe(`${WEB}/login/?error=oauth_invalid_state`);
    expect(forged.headers.location).toBe(`${WEB}/login/?error=oauth_invalid_state`);
  });

  it('does not let a state issued for one provider be used with another', async () => {
    ctx.oauthProfiles.set('c', {
      providerUserId: 'x',
      email: 'a@example.com',
      emailVerified: true,
    });
    const { state } = await start('client=web', 'google');
    const res = await get(`/v1/auth/oauth/discord/callback?state=${state}&code=c`);
    expect(res.headers.location).toBe(`${WEB}/login/?error=oauth_invalid_state`);
  });

  it('keeps banned users out', async () => {
    const admin = await ctx.signUp('admin@example.com');
    await ctx.db.query(`update users set role = 'admin' where id = $1`, [admin.userId]);
    await webSignIn({ id: 'g-1', email: 'a@example.com' });
    const target = (await userByEmail('a@example.com'))!.id;
    await ctx.post(
      `/v1/admin/users/${target}/ban`,
      { kind: 'ban', reason: 'Abus' },
      admin.accessToken,
    );

    const res = await webSignIn({ id: 'g-1', email: 'a@example.com' });
    expect(res.headers.location).toBe(`${WEB}/login/?error=account_banned`);
    expect(res.cookies.find((c) => c.name === 'rt')).toBeUndefined();
  });
});

describe('sign-in with Google or Discord (desktop app)', () => {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');

  async function desktopCode() {
    ctx.oauthProfiles.set('c', {
      providerUserId: 'g-1',
      email: 'a@example.com',
      emailVerified: true,
    });
    const { state } = await start(`client=desktop&port=51234&challenge=${challenge}`);
    const res = await get(`/v1/auth/oauth/google/callback?state=${state}&code=c`);
    const back = new URL(res.headers.location as string);
    return { res, back, code: back.searchParams.get('code')! };
  }
  const exchange = (code: string, v: string) =>
    ctx.post('/v1/auth/oauth/exchange', { code, verifier: v, deviceName: 'PC de test' });

  it('hands a one-time code to the app on its loopback port, with no cookie', async () => {
    const { res, back } = await desktopCode();
    expect(back.origin).toBe('http://127.0.0.1:51234');
    expect(back.pathname).toBe('/callback');
    expect(res.cookies).toHaveLength(0);
    expect((await ctx.db.query('select 1 from sessions')).rows).toHaveLength(0);
  });

  it('exchanges the code for tokens when the app proves it started the flow', async () => {
    const { code } = await desktopCode();
    const tokens = await exchange(code, verifier);
    expect(tokens.status).toBe(200);
    expect(tokens.body.refreshToken).toBeTypeOf('string');
    const sessions = await ctx.get('/v1/me/sessions', tokens.body.accessToken);
    expect(sessions.body.sessions[0].deviceName).toBe('PC de test');
  });

  it('gives nothing to a program that stole the code but not the verifier', async () => {
    const { code } = await desktopCode();
    const stolen = await exchange(code, randomBytes(32).toString('base64url'));
    expect(stolen.status).toBe(400);
    // The failed attempt burns the code: the thief cannot retry, and neither can anyone else.
    expect((await exchange(code, verifier)).status).toBe(400);
  });

  it('accepts a code only once', async () => {
    const { code } = await desktopCode();
    expect((await exchange(code, verifier)).status).toBe(200);
    expect((await exchange(code, verifier)).status).toBe(400);
  });

  it('only ever redirects to the loopback address', async () => {
    const bad = await get(
      `/v1/auth/oauth/google/start?client=desktop&port=80&challenge=${challenge}`,
    );
    expect(bad.statusCode).toBe(400);
    const worse = await get(
      `/v1/auth/oauth/google/start?client=desktop&port=evil.example&challenge=${challenge}`,
    );
    expect(worse.statusCode).toBe(400);
  });
});
