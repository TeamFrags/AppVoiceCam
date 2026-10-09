import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { purgeOldPageViews } from '../src/modules/analytics.js';
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
      ['created_at', 'id', 'path', 'referrer_host', 'visitor_id'].sort(),
    );
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
