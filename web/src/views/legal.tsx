import Link from 'next/link';
import type { ReactNode } from 'react';
import { localePath, type Locale } from '@/i18n/config';
import { fmt, rich } from '@/i18n/format';
import { getMessages } from '@/i18n/index';
import { pageMetadata, type View } from '@/i18n/route';
import { CONTACT_EMAIL, LEGAL_UPDATED } from '@/lib/site';

/** Tags the legal texts may use to point at each other: <terms>…</terms>, <mail>…</mail>… */
export function legalTags(locale: Locale): Record<string, (text: string) => ReactNode> {
  const page = (path: string) => (text: string) => (
    <Link href={localePath(locale, path)}>{text}</Link>
  );
  return {
    terms: page('/terms/'),
    refunds: page('/refunds/'),
    privacy: page('/privacy/'),
    support: page('/support/'),
    mail: () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>,
  };
}

export function lastUpdated(locale: Locale): string {
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(LEGAL_UPDATED),
  );
  return fmt(getMessages(locale).legal.updated, { date });
}

/** A page made of titled sections of plain paragraphs. */
function legalView(key: 'terms' | 'refunds', path: string): View {
  return {
    metadata(locale) {
      const t = getMessages(locale)[key];
      return pageMetadata(locale, path, { title: t.title, description: t.description });
    },
    Page({ locale }) {
      const t = getMessages(locale)[key];
      const tags = legalTags(locale);
      return (
        <section>
          <div className="container narrow">
            <h1>{t.title}</h1>
            <p className="muted">{lastUpdated(locale)}</p>
            {t.sections.map((section) => (
              <div key={section.title}>
                <h2>{section.title}</h2>
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{rich(paragraph, tags)}</p>
                ))}
              </div>
            ))}
          </div>
        </section>
      );
    },
  };
}

export const terms = legalView('terms', '/terms/');
export const refunds = legalView('refunds', '/refunds/');
