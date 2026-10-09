import type { Queryable } from '../db/client.js';

/** CNIL guidance for audience measurement: keep raw data at most 25 months. */
const RETENTION_MONTHS = 25;

/**
 * Country of a request, from the header Cloudflare adds after locating the IP address. The
 * address itself is never read here. Anything but a real country code (absent header, "XX" for
 * unknown, "T1" for Tor) gives null.
 */
export function countryFromHeader(header: string | string[] | undefined): string | null {
  const code = typeof header === 'string' ? header.toUpperCase() : '';
  return /^[A-Z]{2}$/.test(code) && code !== 'XX' ? code : null;
}

export async function recordPageView(
  q: Queryable,
  view: { visitorId: string; path: string; referrerHost?: string; country?: string | null },
): Promise<void> {
  await q.query(
    'insert into page_views (visitor_id, path, referrer_host, country) values ($1, $2, $3, $4)',
    [view.visitorId, view.path, view.referrerHost ?? null, view.country ?? null],
  );
}

export async function purgeOldPageViews(q: Queryable): Promise<void> {
  await q.query(
    'delete from page_views where created_at < now() - make_interval(months => $1::int)',
    [RETENTION_MONTHS],
  );
}

export async function pageViewReport(q: Queryable, days: number) {
  const since = 'now() - make_interval(days => $1::int)';
  // Days and hours are cut in UTC whatever the time zone of the database server.
  const utc = `created_at at time zone 'UTC'`;
  const [daily, pages, referrers, countries, hours] = await Promise.all([
    q.query<{ day: string; views: number; visitors: number }>(
      `select to_char(${utc}, 'YYYY-MM-DD') as day,
              count(*)::int as views, count(distinct visitor_id)::int as visitors
         from page_views where created_at >= ${since}
        group by 1 order by 1`,
      [days],
    ),
    q.query<{ path: string; views: number }>(
      `select path, count(*)::int as views from page_views where created_at >= ${since}
        group by path order by views desc, path limit 20`,
      [days],
    ),
    q.query<{ host: string; views: number }>(
      `select referrer_host as host, count(*)::int as views from page_views
        where created_at >= ${since} and referrer_host is not null
        group by referrer_host order by views desc, host limit 20`,
      [days],
    ),
    // A null country (not located) is reported too, so the shares add up to all visitors.
    q.query<{ country: string | null; visitors: number }>(
      `select country, count(distinct visitor_id)::int as visitors from page_views
        where created_at >= ${since}
        group by country order by visitors desc, country limit 50`,
      [days],
    ),
    q.query<{ hour: number; views: number }>(
      `select extract(hour from ${utc})::int as hour, count(*)::int as views
         from page_views where created_at >= ${since}
        group by 1 order by 1`,
      [days],
    ),
  ]);
  return {
    days,
    daily: daily.rows,
    topPages: pages.rows,
    topReferrers: referrers.rows,
    countries: countries.rows,
    hours: hours.rows,
  };
}
