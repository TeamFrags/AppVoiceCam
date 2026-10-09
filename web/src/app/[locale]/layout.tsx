import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { SiteShell } from '@/components/SiteShell';
import { DEFAULT_LOCALE, isLocale, LOCALES } from '@/i18n/config';
import { siteMetadata } from '@/i18n/route';
import { brand } from '@/lib/site';

type Props = { params: Promise<{ locale: string }>; children: ReactNode };

// One static copy of the site per language; anything else under the root is a 404.
export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== DEFAULT_LOCALE).map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? siteMetadata(locale) : {};
}
export const viewport: Viewport = { themeColor: brand.colors.night };

export default async function LocaleLayout({ params, children }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <SiteShell locale={locale}>{children}</SiteShell>;
}
