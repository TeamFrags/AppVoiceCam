import type { Queryable } from '../db/client.js';

/** Stated in the privacy policy: an application is kept one year, then deleted. */
const RETENTION_MONTHS = 12;

export const CREATOR_PLATFORMS = ['twitch', 'youtube', 'tiktok', 'kick', 'other'] as const;

export interface CreatorApplication {
  name: string;
  email: string;
  platform: (typeof CREATOR_PLATFORMS)[number];
  channelUrl: string;
  message?: string;
  locale?: string;
}

export async function recordCreatorApplication(
  q: Queryable,
  application: CreatorApplication,
): Promise<void> {
  await q.query(
    `insert into creator_applications (name, email, platform, channel_url, message, locale)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      application.name,
      application.email,
      application.platform,
      application.channelUrl,
      application.message || null,
      application.locale ?? null,
    ],
  );
}

export async function purgeOldCreatorApplications(q: Queryable): Promise<void> {
  await q.query(
    'delete from creator_applications where created_at < now() - make_interval(months => $1::int)',
    [RETENTION_MONTHS],
  );
}

export async function listCreatorApplications(q: Queryable) {
  const { rows } = await q.query<{
    id: string;
    name: string;
    email: string;
    platform: string;
    channel_url: string;
    message: string | null;
    locale: string | null;
    created_at: Date;
  }>('select * from creator_applications order by created_at desc limit 500');
  return rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    email: row.email,
    platform: row.platform,
    channelUrl: row.channel_url,
    message: row.message,
    locale: row.locale,
    createdAt: row.created_at,
  }));
}
