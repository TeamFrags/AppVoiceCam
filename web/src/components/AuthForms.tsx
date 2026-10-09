'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useI18n } from '@/i18n/client';
import { localePath } from '@/i18n/config';
import { fmt, rich } from '@/i18n/format';
import { ApiError, errorMessage, publicApi, signIn } from '@/lib/api';
import { API_URL } from '@/lib/site';

type Status = { kind: 'idle' | 'busy' } | { kind: 'error' | 'success'; message: string };

function Notice({ status }: { status: Status }) {
  if (status.kind !== 'error' && status.kind !== 'success') return null;
  return (
    <p className={`notice ${status.kind}`} role={status.kind === 'error' ? 'alert' : 'status'}>
      {status.message}
    </p>
  );
}

function Field(props: {
  label: string;
  name: string;
  type: string;
  autoComplete: string;
  minLength?: number;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        name={props.name}
        type={props.type}
        autoComplete={props.autoComplete}
        minLength={props.minLength}
        maxLength={props.type === 'password' ? 128 : 254}
        required
      />
    </label>
  );
}

/** Runs a submit handler with shared busy and error handling. */
function useSubmit(action: (data: FormData) => Promise<string | void>) {
  const { locale, t } = useI18n();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus({ kind: 'busy' });
    try {
      const message = await action(new FormData(event.currentTarget));
      setStatus(message ? { kind: 'success', message } : { kind: 'idle' });
    } catch (err) {
      setStatus({ kind: 'error', message: errorMessage(err, t.errors, locale) });
    }
  };
  return { status, onSubmit, busy: status.kind === 'busy', done: status.kind === 'success' };
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div className="container">
        <div className="auth card">
          <h1 style={{ fontSize: '1.8rem' }}>{title}</h1>
          {children}
        </div>
      </div>
    </section>
  );
}

const PROVIDER_LABELS: Record<string, string> = { google: 'Google', discord: 'Discord' };

/** Sign-in buttons for the providers the server has configured (none until keys are set). */
function ProviderButtons() {
  const { t } = useI18n();
  const [providers, setProviders] = useState<string[]>([]);
  useEffect(() => {
    fetch(`${API_URL}/v1/auth/oauth/providers`)
      .then((res) => res.json())
      .then((data: { providers?: string[] }) => setProviders(data.providers ?? []))
      .catch(() => setProviders([]));
  }, []);

  const known = providers.filter((provider) => PROVIDER_LABELS[provider]);
  if (known.length === 0) return null;
  return (
    <div className="providers">
      {known.map((provider) => (
        // A plain link: the browser leaves for the provider and comes back signed in.
        <a
          key={provider}
          className="btn ghost"
          href={`${API_URL}/v1/auth/oauth/${provider}/start?client=web`}
        >
          {fmt(t.auth.continueWith, { provider: PROVIDER_LABELS[provider] ?? provider })}
        </a>
      ))}
      <p className="muted divider">{t.auth.or}</p>
    </div>
  );
}

/** One-time tokens arrive in the query string of the link sent by email. */
function tokenFromUrl(): string {
  return new URLSearchParams(window.location.search).get('token') ?? '';
}

export function LoginForm() {
  const { locale, t } = useI18n();
  const router = useRouter();
  // A failed Google or Discord sign-in comes back here with the reason in the address.
  const [returnedCode, setReturnedCode] = useState<string | null>(null);
  useEffect(() => {
    setReturnedCode(new URLSearchParams(window.location.search).get('error'));
  }, []);
  const { status, onSubmit, busy } = useSubmit(async (data) => {
    await signIn(String(data.get('email')), String(data.get('password')), t.account.webBrowser);
    router.push(localePath(locale, '/account/'));
  });
  const returned: Status | null = returnedCode
    ? { kind: 'error', message: errorMessage(new ApiError(400, returnedCode), t.errors, locale) }
    : null;
  return (
    <Card title={t.auth.signInTitle}>
      <Notice status={status.kind === 'idle' && returned ? returned : status} />
      <ProviderButtons />
      <form onSubmit={onSubmit}>
        <Field label={t.auth.email} name="email" type="email" autoComplete="email" />
        <Field
          label={t.auth.password}
          name="password"
          type="password"
          autoComplete="current-password"
        />
        <button className="btn" disabled={busy} style={{ width: '100%' }}>
          {t.auth.signIn}
        </button>
      </form>
      <p className="muted" style={{ margin: '16px 0 0' }}>
        <Link href={localePath(locale, '/forgot-password/')}>{t.auth.forgot}</Link> ·{' '}
        <Link href={localePath(locale, '/register/')}>{t.auth.createAccount}</Link>
      </p>
    </Card>
  );
}

export function RegisterForm() {
  const { locale, t } = useI18n();
  const { status, onSubmit, busy, done } = useSubmit(async (data) => {
    await publicApi('/v1/auth/register', {
      email: String(data.get('email')),
      password: String(data.get('password')),
    });
    return t.auth.registerDone;
  });
  return (
    <Card title={t.auth.registerTitle}>
      <Notice status={status} />
      {!done && <ProviderButtons />}
      {!done && (
        <form onSubmit={onSubmit}>
          <Field label={t.auth.email} name="email" type="email" autoComplete="email" />
          <Field
            label={t.auth.passwordNew}
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
          />
          <button className="btn" disabled={busy} style={{ width: '100%' }}>
            {t.auth.register}
          </button>
        </form>
      )}
      <p className="muted" style={{ margin: '16px 0 0' }}>
        {rich(t.auth.already, {
          a: (text) => <Link href={localePath(locale, '/login/')}>{text}</Link>,
        })}
      </p>
    </Card>
  );
}

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const { status, onSubmit, busy, done } = useSubmit(async (data) => {
    await publicApi('/v1/auth/password/forgot', { email: String(data.get('email')) });
    return t.auth.forgotDone;
  });
  return (
    <Card title={t.auth.forgotTitle}>
      <Notice status={status} />
      {!done && (
        <form onSubmit={onSubmit}>
          <Field label={t.auth.email} name="email" type="email" autoComplete="email" />
          <button className="btn" disabled={busy} style={{ width: '100%' }}>
            {t.auth.forgotSubmit}
          </button>
        </form>
      )}
    </Card>
  );
}

export function ResetPasswordForm() {
  const { locale, t } = useI18n();
  const { status, onSubmit, busy, done } = useSubmit(async (data) => {
    await publicApi('/v1/auth/password/reset', {
      token: tokenFromUrl(),
      newPassword: String(data.get('password')),
    });
    return t.auth.resetDone;
  });
  return (
    <Card title={t.auth.resetTitle}>
      <Notice status={status} />
      {done ? (
        <Link href={localePath(locale, '/login/')} className="btn">
          {t.auth.signIn}
        </Link>
      ) : (
        <form onSubmit={onSubmit}>
          <Field
            label={t.auth.resetPassword}
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
          />
          <button className="btn" disabled={busy} style={{ width: '100%' }}>
            {t.auth.save}
          </button>
        </form>
      )}
    </Card>
  );
}

export function VerifyEmail() {
  const { locale, t } = useI18n();
  const [result, setResult] = useState<'busy' | 'verified' | { failed: unknown }>('busy');
  // The link is single-use: this guard keeps React's development double-run from spending it twice.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    publicApi('/v1/auth/verify-email', { token: tokenFromUrl() })
      .then(() => setResult('verified'))
      .catch((err: unknown) => setResult({ failed: err }));
  }, []);

  return (
    <Card title={t.auth.verifyTitle}>
      {result === 'busy' && <p className="muted">{t.auth.verifying}</p>}
      {result === 'verified' && (
        <>
          <Notice status={{ kind: 'success', message: t.auth.verified }} />
          <Link href={localePath(locale, '/login/')} className="btn">
            {t.auth.signIn}
          </Link>
        </>
      )}
      {typeof result === 'object' && (
        <Notice
          status={{ kind: 'error', message: errorMessage(result.failed, t.errors, locale) }}
        />
      )}
    </Card>
  );
}
