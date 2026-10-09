import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTokenService } from '../src/security/tokens.js';
import { createTestContext, lastMailToken, PASSWORD, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});
afterEach(() => ctx.close());

describe('registration and login', () => {
  it('registers, verifies the email, logs in and reads the profile', async () => {
    const { accessToken } = await ctx.signUp('Mixed.Case@Example.com');
    const me = await ctx.get('/v1/me', accessToken);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email: 'mixed.case@example.com', role: 'user' });
  });

  it('refuses login until the email is verified', async () => {
    await ctx.post('/v1/auth/register', { email: 'a@example.com', password: PASSWORD });
    const res = await ctx.post('/v1/auth/login', { email: 'a@example.com', password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('email_not_verified');
  });

  it('does not reveal whether an email is already registered', async () => {
    const first = await ctx.post('/v1/auth/register', {
      email: 'a@example.com',
      password: PASSWORD,
    });
    const second = await ctx.post('/v1/auth/register', {
      email: 'a@example.com',
      password: PASSWORD,
    });
    expect(second.status).toBe(first.status);
    expect(second.body).toEqual(first.body);
    expect(ctx.outbox.map((m) => m.template)).toEqual(['verify_email', 'account_exists']);
  });

  it('rejects weak passwords and malformed input', async () => {
    const res = await ctx.post('/v1/auth/register', { email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.fields).toEqual(['email', 'password']);
  });

  it('never stores the password or tokens in clear text', async () => {
    const { refreshToken } = await ctx.signUp('a@example.com');
    const user = (await ctx.db.query<{ password_hash: string }>('select password_hash from users'))
      .rows[0]!;
    expect(user.password_hash).toMatch(/^\$argon2id\$/);
    const stored = (
      await ctx.db.query<{ token_hash: string }>('select token_hash from refresh_tokens')
    ).rows;
    expect(stored.map((r) => r.token_hash)).not.toContain(refreshToken);
  });

  it('locks the account after repeated failures, even for the right password', async () => {
    await ctx.signUp('a@example.com');
    for (let i = 0; i < 5; i++) {
      const res = await ctx.post('/v1/auth/login', {
        email: 'a@example.com',
        password: 'wrong password!',
      });
      expect(res.status).toBe(401);
    }
    const locked = await ctx.post('/v1/auth/login', { email: 'a@example.com', password: PASSWORD });
    expect(locked.status).toBe(429);
    expect(locked.body.error).toBe('account_locked');
    expect(locked.body.retryAfter).toBeGreaterThan(0);
  });

  it('answers unknown accounts exactly like wrong passwords', async () => {
    await ctx.signUp('a@example.com');
    const wrong = await ctx.post('/v1/auth/login', {
      email: 'a@example.com',
      password: 'wrong password!',
    });
    const unknown = await ctx.post('/v1/auth/login', {
      email: 'nobody@example.com',
      password: PASSWORD,
    });
    expect(unknown.status).toBe(wrong.status);
    expect(unknown.body).toEqual(wrong.body);
  });

  it('rate limits registration per IP', async () => {
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (
        await ctx.post('/v1/auth/register', { email: `u${i}@example.com`, password: PASSWORD })
      ).status;
    }
    expect(last).toBe(429);
  });
});

describe('access tokens', () => {
  it('rejects missing, garbage and foreign-signed tokens', async () => {
    const { userId } = await ctx.signUp('a@example.com');
    const session = (await ctx.db.query<{ id: string }>('select id from sessions')).rows[0]!;
    const forged = await createTokenService({
      issuer: 'http://localhost:4000',
      ttlSec: 600,
    }).signAccess({ userId, sessionId: session.id });

    expect((await ctx.get('/v1/me')).status).toBe(401);
    expect((await ctx.get('/v1/me', 'garbage')).status).toBe(401);
    expect((await ctx.get('/v1/me', forged)).body.error).toBe('invalid_token');
  });
});

describe('sessions', () => {
  it('rotates refresh tokens and revokes the session when an old one is replayed', async () => {
    const first = await ctx.signUp('a@example.com');
    const second = await ctx.post('/v1/auth/refresh', { refreshToken: first.refreshToken });
    expect(second.status).toBe(200);
    expect(second.body.refreshToken).not.toBe(first.refreshToken);

    const replay = await ctx.post('/v1/auth/refresh', { refreshToken: first.refreshToken });
    expect(replay.status).toBe(401);

    // The stolen-token signal kills the legitimate chain too.
    expect(
      (await ctx.post('/v1/auth/refresh', { refreshToken: second.body.refreshToken })).status,
    ).toBe(401);
    expect((await ctx.get('/v1/me', second.body.accessToken)).body.error).toBe('session_revoked');
    const events = (await ctx.db.query<{ type: string }>('select type from security_events')).rows;
    expect(events.map((e) => e.type)).toContain('refresh_token_reuse');
  });

  it('invalidates the session on logout', async () => {
    const { accessToken, refreshToken } = await ctx.signUp('a@example.com');
    expect((await ctx.post('/v1/auth/logout', undefined, accessToken)).status).toBe(204);
    expect((await ctx.get('/v1/me', accessToken)).status).toBe(401);
    expect((await ctx.post('/v1/auth/refresh', { refreshToken })).status).toBe(401);
  });

  it('lists devices and lets the user revoke another one', async () => {
    const pc = await ctx.signUp('a@example.com');
    const laptop = await ctx.post('/v1/auth/login', {
      email: 'a@example.com',
      password: PASSWORD,
      deviceName: 'Laptop',
    });

    const list = await ctx.get('/v1/me/sessions', pc.accessToken);
    expect(list.body.sessions).toHaveLength(2);
    const other = list.body.sessions.find((s: { current: boolean }) => !s.current);
    expect(other.deviceName).toBe('Laptop');

    expect((await ctx.del(`/v1/me/sessions/${other.id}`, pc.accessToken)).status).toBe(204);
    expect((await ctx.get('/v1/me', laptop.body.accessToken)).status).toBe(401);
    expect((await ctx.get('/v1/me', pc.accessToken)).status).toBe(200);
  });

  it("cannot revoke someone else's session", async () => {
    const alice = await ctx.signUp('alice@example.com');
    const bob = await ctx.signUp('bob@example.com');
    const bobSession = (await ctx.get('/v1/me/sessions', bob.accessToken)).body.sessions[0];

    expect((await ctx.del(`/v1/me/sessions/${bobSession.id}`, alice.accessToken)).status).toBe(404);
    expect((await ctx.get('/v1/me', bob.accessToken)).status).toBe(200);
  });
});

describe('password reset', () => {
  it('changes the password, signs out every device and makes the link single-use', async () => {
    const { accessToken } = await ctx.signUp('a@example.com');
    await ctx.post('/v1/auth/password/forgot', { email: 'a@example.com' });
    const token = lastMailToken(ctx, 'reset_password');
    const newPassword = 'a brand new passphrase';

    expect((await ctx.post('/v1/auth/password/reset', { token, newPassword })).status).toBe(200);
    expect((await ctx.get('/v1/me', accessToken)).status).toBe(401);
    expect(
      (await ctx.post('/v1/auth/login', { email: 'a@example.com', password: PASSWORD })).status,
    ).toBe(401);
    expect(
      (await ctx.post('/v1/auth/login', { email: 'a@example.com', password: newPassword })).status,
    ).toBe(200);
    expect((await ctx.post('/v1/auth/password/reset', { token, newPassword })).status).toBe(400);
  });

  it('responds the same for unknown emails and sends nothing', async () => {
    const res = await ctx.post('/v1/auth/password/forgot', { email: 'nobody@example.com' });
    expect(res.status).toBe(202);
    expect(ctx.outbox).toHaveLength(0);
  });

  it('rejects expired links', async () => {
    await ctx.signUp('a@example.com');
    await ctx.post('/v1/auth/password/forgot', { email: 'a@example.com' });
    await ctx.db.query(`update one_time_tokens set expires_at = now() - interval '1 minute'`);
    const res = await ctx.post('/v1/auth/password/reset', {
      token: lastMailToken(ctx, 'reset_password'),
      newPassword: 'a brand new passphrase',
    });
    expect(res.status).toBe(400);
  });
});

describe('bans', () => {
  async function signUpAdmin() {
    const admin = await ctx.signUp('admin@example.com');
    await ctx.db.query(`update users set role = 'admin' where id = $1`, [admin.userId]);
    return admin;
  }

  it('bans immediately with a reason, blocks login and refresh, and audits the action', async () => {
    const admin = await signUpAdmin();
    const user = await ctx.signUp('a@example.com');

    const ban = await ctx.post(
      `/v1/admin/users/${user.userId}/ban`,
      { kind: 'ban', reason: 'Usurpation d’identité' },
      admin.accessToken,
    );
    expect(ban.status).toBe(204);

    const me = await ctx.get('/v1/me', user.accessToken);
    expect(me.status).toBe(403);
    expect(me.body).toMatchObject({
      error: 'account_banned',
      reason: 'Usurpation d’identité',
      until: null,
    });
    expect(
      (await ctx.post('/v1/auth/login', { email: 'a@example.com', password: PASSWORD })).status,
    ).toBe(403);
    expect((await ctx.post('/v1/auth/refresh', { refreshToken: user.refreshToken })).status).toBe(
      401,
    );

    const audit = (
      await ctx.db.query<{ action: string; actor_id: string }>('select * from audit_log')
    ).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: 'user.ban', actor_id: admin.userId });
  });

  it('lifts a ban and lets temporary suspensions expire on their own', async () => {
    const admin = await signUpAdmin();
    const user = await ctx.signUp('a@example.com');
    const login = () => ctx.post('/v1/auth/login', { email: 'a@example.com', password: PASSWORD });

    await ctx.post(
      `/v1/admin/users/${user.userId}/ban`,
      { kind: 'suspension', reason: 'Spam vocal', durationHours: 24 },
      admin.accessToken,
    );
    const blocked = await login();
    expect(blocked.body.kind).toBe('suspension');
    expect(new Date(blocked.body.until).getTime()).toBeGreaterThan(Date.now());

    await ctx.db.query(`update bans set expires_at = now() - interval '1 minute'`);
    expect((await login()).status).toBe(200);

    await ctx.post(
      `/v1/admin/users/${user.userId}/ban`,
      { kind: 'ban', reason: 'Récidive' },
      admin.accessToken,
    );
    expect((await login()).status).toBe(403);
    expect(
      (await ctx.post(`/v1/admin/users/${user.userId}/unban`, undefined, admin.accessToken)).status,
    ).toBe(204);
    expect((await login()).status).toBe(200);
  });

  it('keeps admin endpoints closed to regular users and protects admins', async () => {
    const admin = await signUpAdmin();
    const user = await ctx.signUp('a@example.com');
    const body = { kind: 'ban', reason: 'tentative' };

    expect(
      (await ctx.post(`/v1/admin/users/${admin.userId}/ban`, body, user.accessToken)).status,
    ).toBe(403);
    expect((await ctx.post(`/v1/admin/users/${admin.userId}/ban`, body)).status).toBe(401);
    expect(
      (await ctx.post(`/v1/admin/users/${admin.userId}/ban`, body, admin.accessToken)).status,
    ).toBe(400);
  });

  it('drops admin rights as soon as the role changes, without waiting for token expiry', async () => {
    const admin = await signUpAdmin();
    const user = await ctx.signUp('a@example.com');
    await ctx.db.query(`update users set role = 'user' where id = $1`, [admin.userId]);
    const res = await ctx.post(
      `/v1/admin/users/${user.userId}/ban`,
      { kind: 'ban', reason: 'tentative' },
      admin.accessToken,
    );
    expect(res.status).toBe(403);
  });
});

describe('entitlements', () => {
  it('derives Premium from the server-side subscription only', async () => {
    const { accessToken, userId } = await ctx.signUp('a@example.com');
    const free = await ctx.get('/v1/me/entitlements', accessToken);
    expect(free.body.tier).toBe('free');
    expect(free.body.features.voiceCloning).toBe(false);

    await ctx.db.query(
      `insert into subscriptions (user_id, status, current_period_end) values ($1, 'active', now() + interval '30 days')`,
      [userId],
    );
    expect((await ctx.get('/v1/me/entitlements', accessToken)).body.tier).toBe('premium');

    await ctx.db.query(`update subscriptions set current_period_end = now() - interval '1 day'`);
    expect((await ctx.get('/v1/me/entitlements', accessToken)).body.tier).toBe('free');
  });
});
