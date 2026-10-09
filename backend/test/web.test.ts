import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { purgeOldPageViews } from '../src/modules/analytics.js';
import { purgeOldCreatorApplications } from '../src/modules/creators.js';
import { createTestContext, PASSWORD, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});
afterEach(() => ctx.close());

const json = { 'content-type': 'application/json' };

describe('browser sessions', () => {
  async function webLogin() {
    await ctx.signUp('a@example.com');
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: json,
      payload: { email: 'a@example.com', password: PASSWORD, web: true },
    });
    return { res, cookie: res.cookies.find((c) => c.name === 'rt')! };
  }
  const refreshWith = (value: string) =>
    ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: json,
      payload: {},
      cookies: { rt: value },
    });

  it('keeps the refresh token out of JavaScript reach', async () => {
    const { res, cookie } = await webLogin();
    expect(res.json().refreshToken).toBeUndefined();
    expect(res.json().accessToken).toBeTypeOf('string');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/v1/auth' });
  });

  it('refreshes from the cookie, rotates it, and treats a replay as theft', async () => {
    const { cookie } = await webLogin();
    const refreshed = await refreshWith(cookie.value);
    const rotated = refreshed.cookies.find((c) => c.name === 'rt')!;
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.json().refreshToken).toBeUndefined();
    expect(rotated.value).not.toBe(cookie.value);

    const replay = await refreshWith(cookie.value);
    expect(replay.statusCode).toBe(401);
    expect(replay.cookies.find((c) => c.name === 'rt')?.value).toBe('');
    expect((await refreshWith(rotated.value)).statusCode).toBe(401);
  });

  it('answers 401 when there is no cookie and no token', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: json,
      payload: {},
    });
    expect(res.statusCode).toBe(401);
  });

  it('clears the cookie on logout', async () => {
    const { res, cookie } = await webLogin();
    const out = await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: { authorization: `Bearer ${res.json().accessToken}` },
    });
    expect(out.statusCode).toBe(204);
    expect(out.cookies.find((c) => c.name === 'rt')?.value).toBe('');
    expect((await refreshWith(cookie.value)).statusCode).toBe(401);
  });
});

describe('admin dashboard', () => {
  it('counts visitors, views and accounts per period, for admins only', async () => {
    const admin = await ctx.signUp('admin@example.com');
    const user = await ctx.signUp('user@example.com');
    await ctx.db.query(`update users set role = 'admin' where id = $1`, [admin.userId]);
    const [alice, bob] = [randomUUID(), randomUUID()];
    await ctx.post('/v1/analytics/pageview', { visitorId: alice, path: '/' });
    await ctx.post('/v1/analytics/pageview', { visitorId: alice, path: '/faq/' });
    await ctx.post('/v1/analytics/pageview', { visitorId: bob, path: '/' });
    await ctx.db.query(
      `update page_views set created_at = now() - interval '10 days' where visitor_id = $1`,
      [bob],
    );

    expect((await ctx.get('/v1/admin/overview', user.accessToken)).status).toBe(403);
    const { body } = await ctx.get('/v1/admin/overview', admin.accessToken);
    expect(body.visitors).toEqual({ day: 1, week: 1, month: 2, year: 2 });
    expect(body.views).toEqual({ day: 2, week: 2, month: 3, year: 3 });
    expect(body.signups.day).toBe(2);
    expect(body.accounts).toEqual({ total: 2, verified: 2, premium: 0, activeToday: 2 });
  });

  it('lists accounts with their active sanction, searchable, for admins only', async () => {
    const admin = await ctx.signUp('admin@example.com');
    const user = await ctx.signUp('user@example.com');
    await ctx.db.query(`update users set role = 'admin' where id = $1`, [admin.userId]);

    expect((await ctx.get('/v1/admin/users', user.accessToken)).status).toBe(403);
    expect((await ctx.get('/v1/admin/users', admin.accessToken)).body.users).toHaveLength(2);
    expect((await ctx.get('/v1/admin/users?banned=1', admin.accessToken)).body.users).toEqual([]);

    await ctx.post(
      `/v1/admin/users/${user.userId}/ban`,
      { kind: 'suspension', reason: 'Spam', durationHours: 24 },
      admin.accessToken,
    );
    const banned = await ctx.get('/v1/admin/users?banned=1', admin.accessToken);
    expect(banned.body.users).toMatchObject([
      {
        id: user.userId,
        email: 'user@example.com',
        role: 'user',
        verified: true,
        premium: false,
        ban: { kind: 'suspension', reason: 'Spam' },
      },
    ]);
    expect(banned.body.users[0].ban.until).toBeTypeOf('string');

    const found = await ctx.get('/v1/admin/users?search=ADMIN', admin.accessToken);
    expect(found.body.users).toMatchObject([{ email: 'admin@example.com', ban: null }]);
  });
});

describe('creator program', () => {
  const application = {
    name: 'Kibi',
    email: 'kibi@example.com',
    platform: 'twitch',
    channelUrl: 'https://twitch.tv/kibi',
    message: 'I stream every evening.',
    locale: 'fr',
  };
  const apply = (body: object) => ctx.post('/v1/creators/apply', body);
  const stored = async () => (await ctx.db.query('select * from creator_applications')).rows;

  it('stores an application with only what the applicant typed', async () => {
    expect((await apply(application)).status).toBe(202);
    const rows = await stored();
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]!).sort()).toEqual(
      ['channel_url', 'created_at', 'email', 'id', 'locale', 'message', 'name', 'platform'].sort(),
    );
  });

  it('refuses an incomplete application or a link that is not a web address', async () => {
    const bad = await apply({ ...application, channelUrl: 'javascript:alert(1)' });
    expect(bad).toMatchObject({ status: 400, body: { error: 'invalid_application' } });
    expect((await apply({ ...application, email: 'nope' })).status).toBe(400);
    expect(await stored()).toHaveLength(0);
  });

  it('answers a robot like a person but stores nothing', async () => {
    expect((await apply({ ...application, website: 'https://spam.test' })).status).toBe(202);
    expect(await stored()).toHaveLength(0);
  });

  it('lists applications to admins only', async () => {
    const admin = await ctx.signUp('admin@example.com');
    const user = await ctx.signUp('user@example.com');
    await ctx.db.query(`update users set role = 'admin' where id = $1`, [admin.userId]);
    await apply(application);

    expect((await ctx.get('/v1/admin/creators/applications', user.accessToken)).status).toBe(403);
    const list = await ctx.get('/v1/admin/creators/applications', admin.accessToken);
    expect(list.body.applications).toHaveLength(1);
    expect(list.body.applications[0]).toMatchObject({
      email: 'kibi@example.com',
      channelUrl: 'https://twitch.tv/kibi',
    });
  });

  it('purges applications older than the retention period', async () => {
    await apply(application);
    await apply({ ...application, email: 'old@example.com' });
    await ctx.db.query(
      `update creator_applications set created_at = now() - interval '13 months'
        where email = 'old@example.com'`,
    );
    await purgeOldCreatorApplications(ctx.db);
    expect((await stored()).map((row) => row.email)).toEqual(['kibi@example.com']);
  });
});

describe('audience measurement', () => {
  const view = (body: object) => ctx.post('/v1/analytics/pageview', body);

  it('stores a page view without any personal data', async () => {
    const visitorId = randomUUID();
    expect((await view({ visitorId, path: '/pricing/', referrerHost: 'google.com' })).status).toBe(
      204,
    );
    const rows = (await ctx.db.query('select * from page_views')).rows;
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]!).sort()).toEqual(
      ['country', 'created_at', 'id', 'path', 'referrer_host', 'visitor_id'].sort(),
    );
  });

  it('keeps the country the proxy worked out, never the address', async () => {
    const send = (country: string) =>
      ctx.app.inject({
        method: 'POST',
        url: '/v1/analytics/pageview',
        payload: { visitorId: randomUUID(), path: '/' },
        headers: { 'cf-ipcountry': country },
      });
    await send('fr');
    await send('FR');
    await send('XX');
    await send('not a country');
    await view({ visitorId: randomUUID(), path: '/' });

    const admin = await ctx.signUp('admin@example.com');
    await ctx.db.query(`update users set role = 'admin' where id = $1`, [admin.userId]);
    const { body } = await ctx.get('/v1/admin/analytics/pageviews?days=7', admin.accessToken);
    expect(body.countries).toEqual([
      { country: null, visitors: 3 },
      { country: 'FR', visitors: 2 },
    ]);
    expect(body.hours).toEqual([{ hour: new Date().getUTCHours(), views: 5 }]);
  });

  it('refuses paths that carry a query string, so one-time tokens are never stored', async () => {
    const res = await view({ visitorId: randomUUID(), path: '/reset-password/?token=secret' });
    expect(res.status).toBe(400);
    expect((await ctx.db.query('select 1 from page_views')).rows).toHaveLength(0);
  });

  it('reports views and unique visitors to admins only', async () => {
    const admin = await ctx.signUp('admin@example.com');
    const user = await ctx.signUp('user@example.com');
    await ctx.db.query(`update users set role = 'admin' where id = $1`, [admin.userId]);
    const [alice, bob] = [randomUUID(), randomUUID()];
    await view({ visitorId: alice, path: '/' });
    await view({ visitorId: alice, path: '/pricing/' });
    await view({ visitorId: bob, path: '/' });

    expect((await ctx.get('/v1/admin/analytics/pageviews', user.accessToken)).status).toBe(403);
    const report = await ctx.get('/v1/admin/analytics/pageviews?days=7', admin.accessToken);
    expect(report.body.daily).toHaveLength(1);
    expect(report.body.daily[0]).toMatchObject({ views: 3, visitors: 2 });
    expect(report.body.topPages[0]).toEqual({ path: '/', views: 2 });
  });

  it('reports new accounts per day, and how many existed before, to admins only', async () => {
    const admin = await ctx.signUp('admin@example.com');
    const user = await ctx.signUp('user@example.com');
    const old = await ctx.signUp('old@example.com');
    await ctx.db.query(`update users set role = 'admin' where id = $1`, [admin.userId]);
    await ctx.db.query(`update users set created_at = now() - interval '40 days' where id = $1`, [
      old.userId,
    ]);

    expect((await ctx.get('/v1/admin/analytics/accounts', user.accessToken)).status).toBe(403);
    const { body } = await ctx.get('/v1/admin/analytics/accounts?days=30', admin.accessToken);
    expect(body.before).toBe(1);
    expect(body.daily).toEqual([{ day: new Date().toISOString().slice(0, 10), signups: 2 }]);
  });

  it('purges views older than the retention period', async () => {
    await view({ visitorId: randomUUID(), path: '/' });
    await view({ visitorId: randomUUID(), path: '/faq/' });
    await ctx.db.query(
      `update page_views set created_at = now() - interval '26 months' where path = '/faq/'`,
    );
    await purgeOldPageViews(ctx.db);
    const rows = (await ctx.db.query<{ path: string }>('select path from page_views')).rows;
    expect(rows.map((r) => r.path)).toEqual(['/']);
  });
});
