import { brand } from '@/brand/tokens';

export { brand };

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${brand.domain}`;
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? `https://api.${brand.domain}`;
export const CONTACT_EMAIL = `contact@${brand.domain}`;

/** Monthly Premium price in euros. Displayed in each language's own format. */
export const PREMIUM_PRICE = 9.99;

/** Pages listed in the navigation and the sitemap. `key` is their label in the messages. */
export const PUBLIC_PAGES = [
  { href: '/features/', key: 'features' },
  { href: '/pricing/', key: 'pricing' },
  { href: '/faq/', key: 'faq' },
  { href: '/download/', key: 'download' },
] as const;

/** `slug` names the illustration in public/apps/ and the description in the messages. */
export const APPS = [
  { slug: 'discord', name: 'Discord' },
  { slug: 'roblox', name: 'Roblox' },
  { slug: 'valorant', name: 'Valorant' },
  { slug: 'fortnite', name: 'Fortnite' },
  { slug: 'minecraft', name: 'Minecraft' },
  { slug: 'teamspeak', name: 'TeamSpeak' },
] as const;
