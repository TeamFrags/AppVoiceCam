'use client';

import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { useI18n } from '@/i18n/client';
import { fmt } from '@/i18n/format';
import { api, errorMessage } from '@/lib/api';

interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  verified: boolean;
  premium: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  ban: { kind: 'ban' | 'suspension'; reason: string; until: string | null } | null;
}

// Suspension lengths in hours, keyed like the dashboard periods so they share their labels.
const SUSPENSIONS = { day: 24, week: 168, month: 720 } as const;
type Suspension = keyof typeof SUSPENSIONS;
const SEARCH_DELAY_MS = 250;

/** Accounts, with the ban and unban actions. Rendered only once the dashboard knows the caller is an admin. */
export function AdminUsers() {
  const { locale, t } = useI18n();
  const searchId = useId();
  const lengthId = useId();
  const reasonId = useId();
  const [search, setSearch] = useState('');
  const [bannedOnly, setBannedOnly] = useState(false);
  const [users, setUsers] = useState<User[] | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const query = new URLSearchParams({ search, ...(bannedOnly ? { banned: '1' } : {}) });
    try {
      setUsers((await api<{ users: User[] }>(`/v1/admin/users?${query}`)).users);
      setFailure(null);
    } catch (err) {
      setFailure(err);
    }
  }, [search, bannedOnly]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [load]);

  const act = async (path: string, body?: unknown) => {
    setBusy(true);
    try {
      await api(path, 'POST', body);
      setEditing(null);
      await load();
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(false);
    }
  };

  const ban = (id: string) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const length = String(data.get('length'));
    void act(`/v1/admin/users/${id}/ban`, {
      reason: String(data.get('reason')),
      ...(length in SUSPENSIONS
        ? { kind: 'suspension', durationHours: SUSPENSIONS[length as Suspension] }
        : { kind: 'ban' }),
    });
  };

  const date = (value: string) =>
    new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="card">
      <h2>{t.admin.accounts}</h2>
      <div className="users-filter">
        <div className="field">
          <div className="field-box">
            <input
              id={searchId}
              type="search"
              placeholder=" "
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <label htmlFor={searchId}>{t.admin.search}</label>
          </div>
        </div>
        <label className="muted">
          <input
            type="checkbox"
            checked={bannedOnly}
            onChange={(event) => setBannedOnly(event.target.checked)}
          />{' '}
          {t.admin.bannedOnly}
        </label>
      </div>

      {failure !== null && (
        <p className="notice error" role="alert">
          {errorMessage(failure, t.errors, locale)}
        </p>
      )}
      {users?.length === 0 && <p className="muted">{t.admin.none}</p>}
      <ul className="rows">
        {users?.map((user) => (
          <li key={user.id}>
            <span>
              <strong>{user.email}</strong>
              {user.role === 'admin' && <span className="badge tag">{t.admin.roleAdmin}</span>}
              {user.premium && <span className="badge premium tag">{t.account.premium}</span>}
              {!user.verified && <span className="badge tag">{t.admin.unverified}</span>}
              <br />
              <span className="muted">
                {fmt(t.admin.joined, { date: date(user.createdAt) })}
                {user.lastSeenAt && ` · ${fmt(t.admin.lastSeen, { date: date(user.lastSeenAt) })}`}
              </span>
              {user.ban && (
                <>
                  <br />
                  <span className="sanction">
                    {user.ban.until
                      ? fmt(t.admin.suspendedUntil, { date: date(user.ban.until) })
                      : t.admin.banned}
                    {' · '}
                    {user.ban.reason}
                  </span>
                </>
              )}
            </span>
            {user.ban ? (
              <button
                type="button"
                className="btn small ghost"
                disabled={busy}
                onClick={() => act(`/v1/admin/users/${user.id}/unban`)}
              >
                {t.admin.unban}
              </button>
            ) : (
              user.role !== 'admin' &&
              editing !== user.id && (
                <button
                  type="button"
                  className="btn small ghost"
                  onClick={() => setEditing(user.id)}
                >
                  {t.admin.ban}
                </button>
              )
            )}
            {editing === user.id && !user.ban && (
              <form className="ban-form" onSubmit={ban(user.id)}>
                <div className="field">
                  <div className="field-box">
                    <select id={lengthId} name="length" defaultValue="permanent">
                      <option value="permanent">{t.admin.permanent}</option>
                      {(Object.keys(SUSPENSIONS) as Suspension[]).map((key) => (
                        <option key={key} value={key}>
                          {fmt(t.admin.suspension, { period: t.admin.periods[key] })}
                        </option>
                      ))}
                    </select>
                    <label htmlFor={lengthId}>{t.admin.sanction}</label>
                  </div>
                </div>
                <div className="field">
                  <div className="field-box">
                    <input
                      id={reasonId}
                      name="reason"
                      type="text"
                      placeholder=" "
                      minLength={3}
                      maxLength={500}
                      required
                      autoFocus
                    />
                    <label htmlFor={reasonId}>{t.admin.reason}</label>
                  </div>
                </div>
                <div className="actions">
                  <button className="btn small" disabled={busy} data-busy={busy || undefined}>
                    {t.admin.confirm}
                  </button>
                  <button
                    type="button"
                    className="btn small ghost"
                    onClick={() => setEditing(null)}
                  >
                    {t.admin.cancel}
                  </button>
                </div>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
