import { brand } from '@/brand/tokens';

export { brand };

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${brand.domain}`;
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? `https://api.${brand.domain}`;
export const CONTACT_EMAIL = `contact@${brand.domain}`;

/** Monthly Premium price in euros. Displayed in each language's own format. */
export const PREMIUM_PRICE = 9.99;

/**
 * Number of users shown on the sign-in and registration pages, rounded down ("10,000+").
 * It is a public claim: keep it at or below the real figure, or set it to null to hide it.
 */
export const COMMUNITY_SIZE: number | null = 10_000;

/** Pages listed in the navigation and the sitemap. `key` is their label in the messages. */
export const PUBLIC_PAGES = [
  { href: '/features/', key: 'features' },
  { href: '/pricing/', key: 'pricing' },
  { href: '/faq/', key: 'faq' },
  { href: '/download/', key: 'download' },
] as const;

/** Pages listed in the footer and the sitemap. `key` is their label in the messages. */
export const FOOTER_PAGES = [
  { href: '/creators/', key: 'creators' },
  { href: '/support/', key: 'support' },
  { href: '/terms/', key: 'terms' },
  { href: '/refunds/', key: 'refunds' },
  { href: '/privacy/', key: 'privacy' },
] as const;

/** Date shown on the terms and the refund policy. Change it whenever their text changes. */
export const LEGAL_UPDATED = '2026-10-09';

/** `slug` names the illustration in public/apps/ and the description in the messages. */
export const APPS = [
  { slug: 'discord', name: 'Discord' },
  { slug: 'roblox', name: 'Roblox' },
  { slug: 'valorant', name: 'Valorant' },
  { slug: 'fortnite', name: 'Fortnite' },
  { slug: 'minecraft', name: 'Minecraft' },
  { slug: 'teamspeak', name: 'TeamSpeak' },
] as const;
