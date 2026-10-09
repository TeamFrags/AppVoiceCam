'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useI18n } from '@/i18n/client';
import { localePath } from '@/i18n/config';
import { fmt, rich } from '@/i18n/format';
import { ApiError, errorMessage, publicApi, signIn } from '@/lib/api';
import { API_URL, APPS, COMMUNITY_SIZE } from '@/lib/site';

type Status = { kind: 'idle' | 'busy' } | { kind: 'error' | 'success'; message: string };

export function Notice({ status }: { status: Status }) {
  if (status.kind !== 'error' && status.kind !== 'success') return null;
  return (
    <p className={`notice ${status.kind}`} role={status.kind === 'error' ? 'alert' : 'status'}>
      {status.message}
    </p>
  );
}

/** The label sits inside the box and moves up once the field is focused or filled. */
export function Field(props: {
  label: string;
  name: string;
  type: string;
  autoComplete: string;
  minLength?: number;
}) {
  const { t } = useI18n();
  const id = useId();
  const isPassword = props.type === 'password';
  const [shown, setShown] = useState(false);
  const [length, setLength] = useState(0);
  // A new password shows how close it is to the required length.
  const required = isPassword ? props.minLength : undefined;
  return (
    <div className="field">
      <div className="field-box">
        <input
          id={id}
          name={props.name}
          type={isPassword && shown ? 'text' : props.type}
          autoComplete={props.autoComplete}
          minLength={props.minLength}
          maxLength={isPassword ? 128 : 254}
          placeholder=" "
          onChange={required ? (event) => setLength(event.target.value.length) : undefined}
          required
        />
        <label htmlFor={id}>{props.label}</label>
        {isPassword && (
          <button
            type="button"
            className="field-toggle"
            aria-label={shown ? t.auth.hidePassword : t.auth.showPassword}
            aria-pressed={shown}
            onClick={() => setShown(!shown)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {shown && <path d="M4 4l16 16" />}
            </svg>
          </button>
        )}
      </div>
      {required && (
        <span
          className="meter"
          aria-hidden="true"
          data-ok={length >= required || undefined}
          style={{ '--fill': Math.min(length / required, 1) } as CSSProperties}
        />
      )}
    </div>
  );
}

/** Counts up to a figure when the page opens. Shows the final figure without JavaScript. */
function CountUp({ to, format }: { to: number; format: (value: number) => string }) {
  const [value, setValue] = useState(to);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min((now - start) / 1400, 1);
      setValue(Math.round(to * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [to]);
  // Number formats can differ slightly between the build machine and the browser.
  return <span suppressHydrationWarning>{format(value)}</span>;
}

const CHIP_BARS = [45, 80, 100, 60, 85, 40];

/** What the visitor gets, next to the sign-in and registration forms. */
function Showcase() {
  const { locale, t } = useI18n();
  const integer = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: 'percent' });
  return (
    <aside className="showcase">
      <div className="hero-art showcase-art" aria-hidden="true">
        <Image src="/mascot.svg" alt="" width={220} height={220} priority />
        <span className="chip bars">
          {CHIP_BARS.map((height, i) => (
            <i key={i} style={{ '--h': `${height}%`, '--i': i } as CSSProperties} />
          ))}
        </span>
        <span className="chip">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9 10h.01M15 10h.01M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8" />
          </svg>
        </span>
      </div>
      <p className="showcase-title">
        {rich(t.auth.showcaseTitle, {
          b: (text) => <span className="gradient-text">{text}</span>,
        })}
      </p>
      <ul className="perks">
        {t.auth.perks.map((perk) => (
          <li key={perk}>{perk}</li>
        ))}
      </ul>
      <dl className="stats">
        {COMMUNITY_SIZE !== null && (
          <div>
            <dt>{t.auth.statUsers}</dt>
            <dd className="gradient-text">
              <CountUp to={COMMUNITY_SIZE} format={(value) => `${integer.format(value)}+`} />
            </dd>
          </div>
        )}
        <div>
          <dt>{t.auth.statApps}</dt>
          <dd className="gradient-text">
            <CountUp to={APPS.length} format={(value) => integer.format(value)} />
          </dd>
        </div>
        <div>
          <dt>{t.auth.statLocal}</dt>
          <dd className="gradient-text">
            <CountUp to={100} format={(value) => percent.format(value / 100)} />
          </dd>
        </div>
      </dl>
    </aside>
  );
}

/** Runs a submit handler with shared busy and error handling. */
export function useSubmit(action: (data: FormData) => Promise<string | void>) {
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
        <div className="auth auth-card">
          <h1>{title}</h1>
          {children}
        </div>
      </div>
    </section>
  );
}

/** Sign-in and registration: the form on one side, what the visitor gets on the other. */
function SplitCard(props: { title: string; lead?: string; children: ReactNode }) {
  return (
    <section className="auth-page">
      <div className="container auth-split">
        <Showcase />
        <div className="auth auth-card">
          <h1>{props.title}</h1>
          {props.lead && <p className="muted">{props.lead}</p>}
          {props.children}
        </div>
      </div>
    </section>
  );
}

const PROVIDER_LABELS: Record<string, string> = { google: 'Google', discord: 'Discord' };

const PROVIDER_ICONS: Record<string, ReactNode> = {
  google: (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  ),
  discord: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="#5865F2"
        d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.028C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.099.246.198.373.292a.077.077 0 0 1-.007.128 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.04.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.029 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.029ZM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.419 0 1.333-.956 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.419 0 1.333-.946 2.419-2.157 2.419Z"
      />
    </svg>
  ),
};

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
          {PROVIDER_ICONS[provider]}
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
    <SplitCard title={t.auth.signInTitle} lead={t.auth.signInLead}>
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
        <button className="btn" disabled={busy} data-busy={busy || undefined}>
          {t.auth.signIn}
        </button>
      </form>
      <p className="auth-links">
        <Link href={localePath(locale, '/forgot-password/')}>{t.auth.forgot}</Link>
        <Link href={localePath(locale, '/register/')}>{t.auth.createAccount}</Link>
      </p>
    </SplitCard>
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
    <SplitCard
      title={done ? t.auth.registerDoneTitle : t.auth.registerTitle}
      lead={done ? undefined : t.auth.registerLead}
    >
      {done && (
        <svg className="done-mark" viewBox="0 0 52 52" width="52" height="52" aria-hidden="true">
          <circle cx="26" cy="26" r="24" pathLength="1" />
          <path d="M15 27l8 8 14-16" pathLength="1" />
        </svg>
      )}
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
          <button className="btn" disabled={busy} data-busy={busy || undefined}>
            {t.auth.register}
          </button>
        </form>
      )}
      <p className="auth-links">
        <span className="muted">
          {rich(t.auth.already, {
            a: (text) => <Link href={localePath(locale, '/login/')}>{text}</Link>,
          })}
        </span>
      </p>
    </SplitCard>
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
          <button className="btn" disabled={busy} data-busy={busy || undefined}>
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
          <button className="btn" disabled={busy} data-busy={busy || undefined}>
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
