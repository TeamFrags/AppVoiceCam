import { getConsent, VISITOR_COOKIE } from './consent';
import { API_URL } from './site';

// 13 months, the maximum lifetime recommended by the CNIL for an audience cookie.
const VISITOR_COOKIE_MAX_AGE = 395 * 24 * 3600;

function readVisitorId(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${VISITOR_COOKIE}=([0-9a-f-]{36})`));
  return match?.[1] ?? null;
}

function visitorId(): string {
  const existing = readVisitorId();
  if (existing) return existing;
  // Written once and never renewed, so the 13 months count from the first visit.
  const id = crypto.randomUUID();
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${VISITOR_COOKIE}=${id}; Max-Age=${VISITOR_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  return id;
}

/** Sends one page view, only if the visitor accepted audience measurement. */
export function trackPageView(pathname: string): void {
  if (getConsent() !== 'accepted') return;

  let referrerHost: string | undefined;
  try {
    const host = document.referrer ? new URL(document.referrer).host : '';
    if (host && host !== location.host) referrerHost = host;
  } catch {
    // Unparseable referrer: leave it out.
  }

  // The pathname only: query strings (reset and verification tokens) never leave the page.
  void fetch(`${API_URL}/v1/analytics/pageview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ visitorId: visitorId(), path: pathname, referrerHost }),
    credentials: 'omit',
    keepalive: true,
  }).catch(() => {
    // Measurement must never break the page.
  });
}
