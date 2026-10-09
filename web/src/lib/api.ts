import { fmt } from '@/i18n/format';
import type { Messages } from '@/i18n/messages/en';
import { API_URL } from './site';

// The access token lives in memory only. The refresh token is an HttpOnly cookie that
// JavaScript cannot read, so nothing long-lived is exposed to a script running in the page.
let accessToken: string | null = null;

// Not a credential: only tells the interface whether trying to restore a session is worthwhile.
const SIGNED_IN_HINT = 'signed-in';
export const SESSION_EVENT = 'sessionchange';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

export function hasSessionHint(): boolean {
  try {
    return localStorage.getItem(SIGNED_IN_HINT) === '1';
  } catch {
    return false;
  }
}

function setSessionHint(signedIn: boolean): void {
  try {
    if (signedIn) localStorage.setItem(SIGNED_IN_HINT, '1');
    else localStorage.removeItem(SIGNED_IN_HINT);
  } catch {
    // Storage unavailable: the hint is only a convenience.
  }
  window.dispatchEvent(new Event(SESSION_EVENT));
}

async function request<T>(
  path: string,
  method: string,
  body?: unknown,
  token?: string | null,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network_error');
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const { error, ...details } = data;
    throw new ApiError(res.status, typeof error === 'string' ? error : 'unknown_error', details);
  }
  return data as T;
}

async function refreshNow(): Promise<boolean> {
  try {
    const { accessToken: token } = await request<{ accessToken: string }>(
      '/v1/auth/refresh',
      'POST',
      {},
    );
    accessToken = token;
    // Also covers a sign-in that ended on the server (Google, Discord): only the cookie came back.
    setSessionHint(true);
    return true;
  } catch {
    accessToken = null;
    setSessionHint(false);
    return false;
  }
}

let refreshing: Promise<boolean> | null = null;

/**
 * Refresh tokens are single-use, and replaying one revokes the session. Two tabs refreshing at
 * the same moment would do exactly that, so refreshes are serialised across tabs.
 */
function refreshAccessToken(): Promise<boolean> {
  const run = async (): Promise<boolean> =>
    'locks' in navigator ? await navigator.locks.request('auth-refresh', refreshNow) : refreshNow();
  refreshing ??= run().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Public endpoint: no session involved. */
export function publicApi<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, 'POST', body);
}

/** Authenticated call. Restores or renews the session transparently, once. */
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (!accessToken && !(await refreshAccessToken())) throw new ApiError(401, 'not_signed_in');
  try {
    return await request<T>(path, method, body, accessToken);
  } catch (err) {
    const expired = err instanceof ApiError && err.status === 401 && err.code !== 'not_signed_in';
    if (!expired || !(await refreshAccessToken())) throw err;
    return request<T>(path, method, body, accessToken);
  }
}

/** `deviceName` is what the list of signed-in devices will show for this browser. */
export async function signIn(email: string, password: string, deviceName: string): Promise<void> {
  const res = await request<{ accessToken: string }>('/v1/auth/login', 'POST', {
    email,
    password,
    deviceName,
    web: true,
  });
  accessToken = res.accessToken;
  setSessionHint(true);
}

export async function signOut(): Promise<void> {
  try {
    await api('/v1/auth/logout', 'POST');
  } finally {
    accessToken = null;
    setSessionHint(false);
  }
}

/** `errors` are the texts of the visitor's language (useI18n().t.errors). */
export function errorMessage(err: unknown, errors: Messages['errors'], locale: string): string {
  if (!(err instanceof ApiError)) return errors.generic;
  const { until, reason } = err.details;
  if (err.code === 'account_banned' && typeof reason === 'string') {
    return typeof until === 'string'
      ? fmt(errors.suspended, { date: new Date(until).toLocaleDateString(locale), reason })
      : fmt(errors.banned, { reason });
  }
  return (errors as Record<string, string>)[err.code] ?? errors.generic;
}
