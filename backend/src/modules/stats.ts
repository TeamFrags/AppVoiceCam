import type { Queryable } from '../db/client.js';

// Rolling windows, in days, shown side by side on the admin dashboard.
const PERIODS = { day: 1, week: 7, month: 30, year: 365 } as const;
type Period = keyof typeof PERIODS;

type Counts = Record<Period, number>;

/** `count(...) filter (...)` once per window, so each table is read a single time. */
function perPeriod(expression: string): string {
  return Object.entries(PERIODS)
    .map(
      ([name, days]) =>
        `${expression} filter (where created_at >= now() - interval '${days} days')::int as ${name}`,
    )
    .join(', ');
}

export async function adminOverview(q: Queryable) {
  const one = async <T extends object>(sql: string) => (await q.query<T>(sql)).rows[0]!;

  const [visitors, views, signups, applications, accounts, premium, active] = await Promise.all([
    one<Counts>(`select ${perPeriod('count(distinct visitor_id)')} from page_views`),
    one<Counts>(`select ${perPeriod('count(*)')} from page_views`),
    one<Counts>(`select ${perPeriod('count(*)')} from users where deleted_at is null`),
    one<Counts>(`select ${perPeriod('count(*)')} from creator_applications`),
    one<{ total: number; verified: number }>(
      `select count(*)::int as total, count(email_verified_at)::int as verified
         from users where deleted_at is null`,
    ),
    one<{ count: number }>(
      `select count(*)::int as count from subscriptions
        where status in ('active', 'past_due') and current_period_end > now()`,
    ),
    one<{ count: number }>(
      `select count(distinct user_id)::int as count from sessions
        where revoked_at is null and last_seen_at >= now() - interval '1 day'`,
    ),
  ]);

  return {
    visitors,
    views,
    signups,
    applications,
    accounts: { ...accounts, premium: premium.count, activeToday: active.count },
  };
}

/** New accounts per day (UTC) over the window, and how many accounts existed before it. */
export async function accountsReport(q: Queryable, days: number) {
  const since = 'now() - make_interval(days => $1::int)';
  const [daily, before] = await Promise.all([
    q.query<{ day: string; signups: number }>(
      `select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') as day, count(*)::int as signups
         from users where deleted_at is null and created_at >= ${since}
        group by 1 order by 1`,
      [days],
    ),
    q.query<{ count: number }>(
      `select count(*)::int as count from users
        where deleted_at is null and created_at < ${since}`,
      [days],
    ),
  ]);
  return { days, before: before.rows[0]!.count, daily: daily.rows };
}
