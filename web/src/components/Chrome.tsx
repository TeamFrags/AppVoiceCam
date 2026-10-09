import Image from 'next/image';
import Link from 'next/link';
import { localePath, type Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/index';
import { brand, FOOTER_PAGES, PUBLIC_PAGES } from '@/lib/site';
import { AccountLink } from './AccountLink';
import { ManageCookiesButton } from './CookieConsent';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Header({ locale }: { locale: Locale }) {
  const t = getMessages(locale);
  return (
    <header className="site-header">
      <div className="container">
        <Link href={localePath(locale, '/')} className="logo">
          <Image src="/mascot.svg" alt="" width={36} height={36} priority />
          {brand.name}
        </Link>
        <nav className="site-nav" aria-label={t.nav.main}>
          {PUBLIC_PAGES.map((page) => (
            <Link key={page.href} href={localePath(locale, page.href)}>
              {t.nav[page.key]}
            </Link>
          ))}
          <LanguageSwitcher />
          <AccountLink />
        </nav>
      </div>
    </header>
  );
}

export function Footer({ locale }: { locale: Locale }) {
  const t = getMessages(locale);
  return (
    <footer className="site-footer">
      <div className="container">
        <span>
          © {new Date().getFullYear()} {brand.name}
        </span>
        {FOOTER_PAGES.map((page) => (
          <Link key={page.href} href={localePath(locale, page.href)}>
            {t.footer[page.key]}
          </Link>
        ))}
        <ManageCookiesButton />
      </div>
    </footer>
  );
}
