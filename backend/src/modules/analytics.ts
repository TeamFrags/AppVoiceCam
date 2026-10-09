import type { Queryable } from '../db/client.js';

/** CNIL guidance for audience measurement: keep raw data at most 25 months. */
const RETENTION_MONTHS = 25;

export async function recordPageView(
  q: Queryable,
  view: { visitorId: string; path: string; referrerHost?: string },
): Promise<void> {
  await q.query('insert into page_views (visitor_id, path, referrer_host) values ($1, $2, $3)', [
    view.visitorId,
    view.path,
    view.referrerHost ?? null,
  ]);
}

export async function purgeOldPageViews(q: Queryable): Promise<void> {
  await q.query(
    'delete from page_views where created_at < now() - make_interval(months => $1::int)',
    [RETENTION_MONTHS],
  );
}

export async function pageViewReport(q: Queryable, days: number) {
  const since = 'now() - make_interval(days => $1::int)';
  const daily = await q.query<{ day: string; views: number; visitors: number }>(
    `select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
            count(*)::int as views, count(distinct visitor_id)::int as visitors
       from page_views where created_at >= ${since}
      group by 1 order by 1`,
    [days],
  );
  const pages = await q.query<{ path: string; views: number }>(
    `select path, count(*)::int as views from page_views where created_at >= ${since}
      group by path order by views desc, path limit 20`,
    [days],
  );
  const referrers = await q.query<{ host: string; views: number }>(
    `select referrer_host as host, count(*)::int as views from page_views
      where created_at >= ${since} and referrer_host is not null
      group by referrer_host order by views desc, host limit 20`,
    [days],
  );
  return { days, daily: daily.rows, topPages: pages.rows, topReferrers: referrers.rows };
}
