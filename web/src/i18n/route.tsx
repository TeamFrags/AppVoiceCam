import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { brand, SITE_URL } from '@/lib/site';
import {
  DEFAULT_LOCALE,
  isLocale,
  localePath,
  LOCALES,
  OPEN_GRAPH_LOCALES,
  type Locale,
} from './config';
import { getMessages, tagline } from './index';

/** A page written once and served in every language. */
export interface View {
  Page: (props: { locale: Locale }) => ReactNode;
  metadata: (locale: Locale) => Metadata;
}

type Params = { params: Promise<{ locale: string }> };

async function localeOf({ params }: Params): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

/** For the files of app/(default)/: the page in English, at the root of the site. */
export function defaultRoute(view: View) {
  return {
    metadata: view.metadata(DEFAULT_LOCALE),
    Page: () => <view.Page locale={DEFAULT_LOCALE} />,
  };
}

/** For the files of app/[locale]/: the same page under /fr/, /es/… */
export function localeRoute(view: View) {
  return {
    generateMetadata: async (props: Params) => view.metadata(await localeOf(props)),
    Page: async (props: Params) => <view.Page locale={await localeOf(props)} />,
  };
}

/** Metadata shared by every page of one language. */
export function siteMetadata(locale: Locale): Metadata {
  const description = getMessages(locale).meta.description;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${brand.name} — ${tagline(locale)}`, template: `%s — ${brand.name}` },
    description,
    openGraph: {
      type: 'website',
      siteName: brand.name,
      locale: OPEN_GRAPH_LOCALES[locale],
      description,
    },
  };
}

/** Metadata of one page: its own address, and the same page in the other languages. */
export function pageMetadata(
  locale: Locale,
  path: string,
  page: { title?: string; description?: string; noindex?: boolean } = {},
): Metadata {
  return {
    title: page.title,
    description: page.description,
    robots: page.noindex ? { index: false } : undefined,
    alternates: {
      canonical: localePath(locale, path),
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, localePath(l, path)])),
        'x-default': localePath(DEFAULT_LOCALE, path),
      },
    },
  };
}
