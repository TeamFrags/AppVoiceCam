import type { MetadataRoute } from 'next';
import { localePath, LOCALES } from '@/i18n/config';
import { PUBLIC_PAGES, SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['/', ...PUBLIC_PAGES.map((page) => page.href), '/privacy/'];
  // Every page is listed once per language, each entry pointing at its translations.
  return paths.flatMap((path) => {
    const languages = Object.fromEntries(
      LOCALES.map((locale) => [locale, `${SITE_URL}${localePath(locale, path)}`]),
    );
    return LOCALES.map((locale) => ({
      url: `${SITE_URL}${localePath(locale, path)}`,
      priority: path === '/' ? 1 : 0.7,
      alternates: { languages },
    }));
  });
}
