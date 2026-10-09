// Server side only: importing this file pulls in every language. Components that run in the
// browser get their texts from the provider in ./client.tsx instead.
import { APPS, brand, CONTACT_EMAIL, PREMIUM_PRICE } from '@/lib/site';
import type { Locale } from './config';
import { fmt } from './format';
import { de } from './messages/de';
import { en, type Messages } from './messages/en';
import { es } from './messages/es';
import { fr } from './messages/fr';
import { pt } from './messages/pt';

const DICTIONARIES: Record<Locale, Messages> = { en, fr, es, pt, de };

function fill<T>(value: T, vars: Record<string, string>): T {
  if (typeof value === 'string') return fmt(value, vars) as T;
  if (Array.isArray(value)) return value.map((item) => fill(item, vars)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, fill(item, vars)]),
    ) as T;
  }
  return value;
}

/** An amount in euros, written the way the language writes it ("€9.99", "9,99 €"). */
export function euros(locale: Locale, amount: number): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

const cache = new Map<Locale, Messages>();

/** Texts of one language, with the brand, the price and the app names already filled in. */
export function getMessages(locale: Locale): Messages {
  let messages = cache.get(locale);
  if (!messages) {
    messages = fill(DICTIONARIES[locale], {
      name: brand.name,
      mascot: brand.mascotName,
      camera: brand.virtualCameraName,
      microphone: brand.virtualMicrophoneName,
      apps: new Intl.ListFormat(locale, { type: 'conjunction' }).format(APPS.map((a) => a.name)),
      price: euros(locale, PREMIUM_PRICE),
      email: CONTACT_EMAIL,
    });
    cache.set(locale, messages);
  }
  return messages;
}

export function tagline(locale: Locale): string {
  return brand.taglines[locale];
}
