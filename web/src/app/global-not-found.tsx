import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteShell } from '@/components/SiteShell';
import { DEFAULT_LOCALE } from '@/i18n/config';
import { getMessages } from '@/i18n/index';
import { siteMetadata } from '@/i18n/route';

// Served for any unknown address (it becomes 404.html), whatever its language prefix: English.
const t = getMessages(DEFAULT_LOCALE).notFound;

export const metadata: Metadata = { ...siteMetadata(DEFAULT_LOCALE), title: t.title };

export default function GlobalNotFound() {
  return (
    <SiteShell locale={DEFAULT_LOCALE}>
      <section>
        <div className="container narrow cta-band">
          <h1>{t.title}</h1>
          <p className="lead">{t.text}</p>
          <Link href="/" className="btn">
            {t.back}
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
