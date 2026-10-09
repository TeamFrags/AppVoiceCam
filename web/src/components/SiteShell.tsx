import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/sora/700.css';
import '@/brand/tokens.css';
import '@/app/globals.css';
import type { ReactNode } from 'react';
import { I18nProvider } from '@/i18n/client';
import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/index';
import { Footer, Header } from './Chrome';
import { CookieConsent } from './CookieConsent';
import { ScrollReveal } from './ScrollReveal';

/** The whole document around a page. Each root layout renders it in its own language. */
export function SiteShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const t = getMessages(locale);
  const { nav, footer, auth, account, consent, errors } = t;
  return (
    <html lang={locale}>
      <body>
        <I18nProvider locale={locale} messages={{ nav, footer, auth, account, consent, errors }}>
          <a href="#content" className="skip-link">
            {nav.skip}
          </a>
          <Header locale={locale} />
          <main id="content">{children}</main>
          <Footer locale={locale} />
          <CookieConsent />
          <ScrollReveal />
        </I18nProvider>
      </body>
    </html>
  );
}
