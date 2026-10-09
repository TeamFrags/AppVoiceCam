'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/i18n/client';
import { localePath } from '@/i18n/config';
import { fmt, rich } from '@/i18n/format';
import { api, ApiError, errorMessage, signOut } from '@/lib/api';

interface Me {
  email: string;
  role: 'user' | 'admin';
}
interface Entitlements {
  tier: 'free' | 'premium';
  renewsAt: string | null;
}
interface Session {
  id: string;
  deviceName: string;
  ip: string | null;
  lastSeenAt: string;
  current: boolean;
}

export function Account() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [failure, setFailure] = useState<unknown>(null);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

  const load = useCallback(async () => {
    try {
      const [profile, rights, list] = await Promise.all([
        api<Me>('/v1/me'),
        api<Entitlements>('/v1/me/entitlements'),
        api<{ sessions: Session[] }>('/v1/me/sessions'),
      ]);
      setMe(profile);
      setEntitlements(rights);
      setSessions(list.sessions);
    } catch (err) {
      // A ban is explained on this page; any other 401 means there is no session to show.
      if (err instanceof ApiError && err.status === 401) {
        router.replace(localePath(locale, '/login/'));
      } else setFailure(err);
    }
  }, [router, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (id: string) => {
    try {
      await api(`/v1/me/sessions/${id}`, 'DELETE');
      await load();
    } catch (err) {
      setFailure(err);
    }
  };

  const leave = async () => {
    await signOut().catch(() => undefined);
    router.replace(localePath(locale, '/'));
  };

  if (failure) {
    return (
      <section>
        <div className="container narrow">
          <p className="notice error" role="alert">
            {errorMessage(failure, t.errors, locale)}
          </p>
        </div>
      </section>
    );
  }
  if (!me || !entitlements) {
    return (
      <section>
        <div className="container narrow">
          <p className="muted">{t.account.loading}</p>
        </div>
      </section>
    );
  }

  const premium = entitlements.tier === 'premium';
  return (
    <section>
      <div className="container narrow">
        <h1>{t.account.title}</h1>
        <p className="muted">{me.email}</p>

        <div className={`card ${premium ? 'premium' : ''}`} style={{ marginBottom: 16 }}>
          <div className={`badge ${premium ? 'premium' : ''}`}>{t.account.plan}</div>
          <div className="price">{premium ? t.account.premium : t.account.free}</div>
          {premium && entitlements.renewsAt ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              {fmt(t.account.renews, { date: formatDate(entitlements.renewsAt) })}
            </p>
          ) : (
            <p className="muted" style={{ marginBottom: 0 }}>
              {rich(t.account.notOpen, {
                a: (text) => <Link href={localePath(locale, '/pricing/')}>{text}</Link>,
              })}
            </p>
          )}
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.3rem' }}>{t.account.devices}</h2>
          <ul className="rows">
            {sessions.map((session) => (
              <li key={session.id}>
                <span>
                  <strong>{session.deviceName}</strong>
                  {session.current && (
                    <span className="live" style={{ marginLeft: 10 }}>
                      {t.account.thisDevice}
                    </span>
                  )}
                  <br />
                  <span className="muted" style={{ fontSize: '0.9rem' }}>
                    {fmt(t.account.seen, {
                      ip: session.ip ?? t.account.unknownIp,
                      date: formatDate(session.lastSeenAt),
                    })}
                  </span>
                </span>
                {!session.current && (
                  <button
                    type="button"
                    className="btn small ghost"
                    onClick={() => revoke(session.id)}
                  >
                    {t.account.revoke}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="actions">
          {me.role === 'admin' && (
            <Link href={localePath(locale, '/admin/')} className="btn">
              {t.admin.title}
            </Link>
          )}
          <button type="button" className="btn ghost" onClick={leave}>
            {t.account.signOut}
          </button>
        </div>
      </div>
    </section>
  );
}
