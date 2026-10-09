// Languages of the website. To add one: add it here, write its file in messages/, register it
// in index.ts, and give it a tagline in brand/brand.json. The compiler lists what is missing.
export const LOCALES = ['en', 'fr', 'es', 'pt', 'de'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** Each language is named in itself, so a visitor recognises their own. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
  de: 'Deutsch',
};

export const OPEN_GRAPH_LOCALES: Record<Locale, string> = {
  en: 'en_US',
  fr: 'fr_FR',
  es: 'es_ES',
  pt: 'pt_BR',
  de: 'de_DE',
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * English lives at the root: links in emails and in the desktop application point there.
 * Other languages live under /fr/, /es/…
 */
export function localePath(locale: Locale, path: string): string {
  return locale === DEFAULT_LOCALE ? path : `/${locale}${path}`;
}

/** Splits "/fr/pricing/" into the language and the language-neutral path "/pricing/". */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const [, first = '', ...rest] = pathname.split('/');
  if (first !== DEFAULT_LOCALE && isLocale(first)) {
    return { locale: first, path: `/${rest.join('/')}` };
  }
  return { locale: DEFAULT_LOCALE, path: pathname };
}
