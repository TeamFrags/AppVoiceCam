'use client';

import { usePathname } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { LOCALE_NAMES, localePath, LOCALES, splitLocale } from '@/i18n/config';

/** Links to the current page in every other language. */
export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const { path } = splitLocale(usePathname());
  return (
    <details className="lang">
      <summary aria-label={t.nav.language}>{locale.toUpperCase()}</summary>
      <ul>
        {LOCALES.map((other) => (
          <li key={other}>
            {/* A plain link: each language has its own document, so the page reloads anyway. */}
            <a
              href={localePath(other, path)}
              hrefLang={other}
              lang={other}
              aria-current={other === locale ? 'true' : undefined}
            >
              {LOCALE_NAMES[other]}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
