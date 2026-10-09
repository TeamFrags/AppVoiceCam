import type { Viewport } from 'next';
import type { ReactNode } from 'react';
import { SiteShell } from '@/components/SiteShell';
import { DEFAULT_LOCALE } from '@/i18n/config';
import { siteMetadata } from '@/i18n/route';
import { brand } from '@/lib/site';

// English, at the root of the site. The other languages have their own layout in ../[locale]/.
export const metadata = siteMetadata(DEFAULT_LOCALE);
export const viewport: Viewport = { themeColor: brand.colors.night };

export default function DefaultLayout({ children }: { children: ReactNode }) {
  return <SiteShell locale={DEFAULT_LOCALE}>{children}</SiteShell>;
}
