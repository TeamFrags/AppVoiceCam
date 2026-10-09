import type { MetadataRoute } from 'next';
import { localePath, LOCALES } from '@/i18n/config';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';

// Private or single-use pages: nothing to index, in any language.
const PRIVATE_PAGES = ['/account/', '/verify-email/', '/reset-password/'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: LOCALES.flatMap((locale) => PRIVATE_PAGES.map((path) => localePath(locale, path))),
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
