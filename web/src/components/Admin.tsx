'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/i18n/client';
import { localePath } from '@/i18n/config';
import { api, ApiError, errorMessage } from '@/lib/api';
import { BarChart, BarList, LineChart } from './AdminCharts';
import { AdminUsers } from './AdminUsers';
import { Icon, type IconName } from './Icon';

type Period = 'day' | 'week' | 'month' | 'year';
type Counts = Record<Period, number>;

interface Overview {
  visitors: Counts;
  views: Counts;
  signups: Counts;
  applications: Counts;
  accounts: { total: number; verified: number; premium: number; activeToday: number };
}
interface Report {
  daily: { day: string; views: number; visitors: number }[];
  topPages: { path: string; views: number }[];
  topReferrers: { host: string; views: number }[];
  countries: { country: string | null; visitors: number }[];
  hours: { hour: number; views: number }[];
}
interface AccountsReport {
  before: number;
  daily: { day: string; signups: number }[];
}
interface Application {
  id: number;
  name: string;
  email: string;
  platform: string;
  channelUrl: string;
  message: string | null;
  createdAt: string;
}

// Chart ranges, keyed like the periods so they share their labels.
const RANGES = { week: 7, month: 30, year: 365 } as const;
type Range = keyof typeof RANGES;
const REFRESH_MS = 15_000;

const SECTIONS = {
  overview: 'gauge',
  audience: 'globe',
  accounts: 'users',
  creators: 'spark',
} as const satisfies Record<string, IconName>;
type Section = keyof typeof SECTIONS;
const isSection = (name: string): name is Section => name in SECTIONS;

/** The days of the range, oldest first, as UTC dates: the server counts by UTC day too. */
function rangeDays(range: Range): Date[] {
  const today = new Date();
  return Array.from(
    { length: RANGES[range] },
    (_, i) =>
      new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i)),
  ).reverse();
}
const dayKey = (date: Date) => date.toISOString().slice(0, 10);

/** One bar per day, or per month over a year. */
function buildBars(days: Date[], values: Map<string, number>, range: Range, locale: string) {
  const byDay = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  if (range !== 'year') {
    return days.map((day) => ({ label: byDay.format(day), value: values.get(dayKey(day)) ?? 0 }));
  }
  const byMonth = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const months = new Map<string, number>();
  for (const day of days) {
    const key = byMonth.format(day);
    months.set(key, (months.get(key) ?? 0) + (values.get(dayKey(day)) ?? 0));
  }
  return [...months].map(([label, value]) => ({ label, value }));
}

/** Views per hour of the day, moved from UTC to the time zone of this browser. */
function buildHours(report: Report, locale: string) {
  const shift = Math.round(-new Date().getTimezoneOffset() / 60);
  const views = new Array<number>(24).fill(0);
  for (const row of report.hours) views[(((row.hour + shift) % 24) + 24) % 24]! += row.views;
  const label = new Intl.DateTimeFormat(locale, { hour: 'numeric', timeZone: 'UTC' });
  return views.map((value, hour) => ({
    label: label.format(new Date(Date.UTC(2000, 0, 1, hour))),
    value,
  }));
}

export function Admin() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [section, setSection] = useState<Section>('overview');
  const [range, setRange] = useState<Range>('month');
  const [data, setData] = useState<{
    overview: Overview;
    report: Report;
    accounts: AccountsReport;
    applications: Application[];
  } | null>(null);
  const [failure, setFailure] = useState<unknown>(null);

  // The section is kept in the address, so a reload or a shared link opens the same one.
  useEffect(() => {
    const fromHash = () => {
      const name = location.hash.slice(1);
      if (isSection(name)) setSection(name);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);

  const open = (name: Section) => {
    setSection(name);
    history.replaceState(null, '', `#${name}`);
  };

  const load = useCallback(async () => {
    try {
      const days = RANGES[range];
      const [overview, report, accounts, list] = await Promise.all([
        api<Overview>('/v1/admin/overview'),
        api<Report>(`/v1/admin/analytics/pageviews?days=${days}`),
        api<AccountsReport>(`/v1/admin/analytics/accounts?days=${days}`),
        api<{ applications: Application[] }>('/v1/admin/creators/applications'),
      ]);
      setData({ overview, report, accounts, applications: list.applications });
      setFailure(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace(localePath(locale, '/login/'));
      } else setFailure(err);
    }
  }, [router, locale, range]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (failure) {
    const forbidden = failure instanceof ApiError && failure.status === 403;
    return (
      <section>
        <div className="container narrow">
          <p className="notice error" role="alert">
            {forbidden ? t.admin.forbidden : errorMessage(failure, t.errors, locale)}
          </p>
        </div>
      </section>
    );
  }
  if (!data) {
    return (
      <section>
        <div className="container narrow">
          <p className="muted">{t.account.loading}</p>
        </div>
      </section>
    );
  }

  const { overview, report, accounts, applications } = data;
  const number = new Intl.NumberFormat(locale);
  const format = (value: number) => number.format(value);
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  const shortDay = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

  const days = rangeDays(range);
  const dayLabels = days.map((day) => shortDay.format(day));
  const byDay = new Map(report.daily.map((row) => [row.day, row]));
  const signups = new Map(accounts.daily.map((row) => [row.day, row.signups]));
  let running = accounts.before;
  const totals = days.map((day) => (running += signups.get(dayKey(day)) ?? 0));

  const regions = new Intl.DisplayNames(locale, { type: 'region' });
  const countries = report.countries.map((row) => ({
    label: (row.country && regions.of(row.country)) || t.admin.unknownCountry,
    value: row.visitors,
  }));
  const hours = buildHours(report, locale);

  const tiles = (items: (readonly [string, number])[]) => (
    <dl className="stats">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{format(value)}</dd>
        </div>
      ))}
    </dl>
  );
  const audienceTiles = [
    [t.admin.visitors, overview.visitors[range]],
    [t.admin.views, overview.views[range]],
  ] as const;

  return (
    <section className="admin-page">
      <div className="admin-shell">
        <aside className="admin-side">
          <p className="admin-side-title">{t.admin.title}</p>
          <nav aria-label={t.admin.title}>
            {(Object.keys(SECTIONS) as Section[]).map((name) => (
              <button
                key={name}
                type="button"
                aria-current={section === name ? 'page' : undefined}
                onClick={() => open(name)}
              >
                <Icon name={SECTIONS[name]} />
                {t.admin.sections[name]}
                {name === 'creators' && applications.length > 0 && (
                  <span className="count">{format(applications.length)}</span>
                )}
              </button>
            ))}
          </nav>
          <p className="live">{t.admin.live}</p>
        </aside>

        <div className="admin">
          <div className="chart-head">
            <h1>{t.admin.sections[section]}</h1>
            {section !== 'creators' && (
              <div className="segmented" role="group" aria-label={t.admin.total}>
                {(Object.keys(RANGES) as Range[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={range === key}
                    onClick={() => setRange(key)}
                  >
                    {t.admin.periods[key]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {section === 'overview' && (
            <>
              {tiles([
                [t.admin.accounts, overview.accounts.total],
                [t.admin.activeToday, overview.accounts.activeToday],
                [t.admin.premium, overview.accounts.premium],
                [t.admin.verified, overview.accounts.verified],
              ])}
              {tiles([
                ...audienceTiles,
                [t.admin.signups, overview.signups[range]],
                [t.admin.applications, overview.applications[range]],
              ])}
              <div className="card">
                <h2>{t.admin.traffic}</h2>
                <LineChart
                  title={t.admin.traffic}
                  labels={dayLabels}
                  format={format}
                  series={[
                    {
                      name: t.admin.views,
                      values: days.map((day) => byDay.get(dayKey(day))?.views ?? 0),
                    },
                    {
                      name: t.admin.visitors,
                      values: days.map((day) => byDay.get(dayKey(day))?.visitors ?? 0),
                    },
                  ]}
                />
                <p className="muted form-note">{t.admin.consentNote}</p>
              </div>
              <div className="card">
                <h2>{t.admin.growth}</h2>
                <LineChart
                  title={t.admin.growth}
                  labels={dayLabels}
                  format={format}
                  series={[{ name: t.admin.accounts, values: totals }]}
                />
              </div>
            </>
          )}

          {section === 'audience' && (
            <>
              {tiles([...audienceTiles])}
              <div className="grid pairs">
                <div className="card">
                  <h2>{t.admin.countries}</h2>
                  <BarList rows={countries} empty={t.admin.none} format={format} />
                </div>
                <div className="card">
                  <h2>{t.admin.hours}</h2>
                  <BarChart
                    bars={hours}
                    totalLabel={t.admin.total}
                    axis={[0, 6, 12, 18, 23].map((hour) => hours[hour]!.label)}
                    format={format}
                  />
                  <p className="muted form-note">{t.admin.hoursNote}</p>
                </div>
                <div className="card">
                  <h2>{t.admin.topPages}</h2>
                  <BarList
                    rows={report.topPages.map((page) => ({ label: page.path, value: page.views }))}
                    empty={t.admin.none}
                    format={format}
                  />
                </div>
                <div className="card">
                  <h2>{t.admin.topReferrers}</h2>
                  <BarList
                    rows={report.topReferrers.map((row) => ({ label: row.host, value: row.views }))}
                    empty={t.admin.none}
                    format={format}
                  />
                </div>
              </div>
              <p className="muted form-note">
                {t.admin.consentNote} {t.admin.locationNote}
              </p>
            </>
          )}

          {section === 'accounts' && (
            <>
              {tiles([
                [t.admin.accounts, overview.accounts.total],
                [t.admin.signups, overview.signups[range]],
                [t.admin.premium, overview.accounts.premium],
                [t.admin.verified, overview.accounts.verified],
              ])}
              <div className="card">
                <h2>{t.admin.signups}</h2>
                <BarChart
                  bars={buildBars(days, signups, range, locale)}
                  totalLabel={t.admin.total}
                  format={format}
                />
              </div>
              <AdminUsers />
            </>
          )}

          {section === 'creators' && (
            <div className="card">
              <h2>{t.admin.applications}</h2>
              {applications.length === 0 && <p className="muted">{t.admin.none}</p>}
              <ul className="rows">
                {applications.map((application) => (
                  <li key={application.id}>
                    <span>
                      <strong>{application.name}</strong> ·{' '}
                      <a href={`mailto:${application.email}`}>{application.email}</a>
                      <br />
                      <a href={application.channelUrl} target="_blank" rel="noopener noreferrer">
                        {application.channelUrl}
                      </a>
                      {application.message && (
                        <>
                          <br />
                          <span className="muted">{application.message}</span>
                        </>
                      )}
                    </span>
                    <span className="muted">
                      {dateTime.format(new Date(application.createdAt))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
