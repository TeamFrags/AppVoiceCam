'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/client';
import { localePath } from '@/i18n/config';
import { rich } from '@/i18n/format';
import { trackPageView } from '@/lib/analytics';
import {
  CONSENT_EVENT,
  getConsent,
  OPEN_CONSENT_EVENT,
  setConsent,
  type ConsentChoice,
} from '@/lib/consent';

/** Asks for the visitor's choice, and reports page views once (and only if) they accepted. */
export function CookieConsent() {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(getConsent() === null);
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  useEffect(() => {
    trackPageView(pathname);
    // A visitor who accepts on this page is counted for it too.
    const onChange = () => trackPageView(pathname);
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, [pathname]);

  if (!open) return null;

  const choose = (choice: ConsentChoice) => {
    setConsent(choice);
    setOpen(false);
  };

  return (
    <div className="consent" role="dialog" aria-labelledby="consent-title" aria-live="polite">
      <h2 id="consent-title" style={{ fontSize: '1.1rem' }}>
        {t.consent.title}
      </h2>
      <p>
        {rich(t.consent.text, {
          a: (text) => <Link href={`${localePath(locale, '/privacy/')}#cookies`}>{text}</Link>,
        })}
      </p>
      <div className="actions">
        <button type="button" className="btn" onClick={() => choose('refused')}>
          {t.consent.refuse}
        </button>
        <button type="button" className="btn" onClick={() => choose('accepted')}>
          {t.consent.accept}
        </button>
      </div>
    </div>
  );
}

export function ManageCookiesButton() {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className="link-button"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
    >
      {t.footer.cookies}
    </button>
  );
}
