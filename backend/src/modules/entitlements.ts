import type { Queryable } from '../db/client.js';

export interface Entitlements {
  tier: 'free' | 'premium';
  renewsAt: string | null;
  features: {
    allFaces: boolean;
    allVoices: boolean;
    customFaces: boolean;
    voiceCloning: boolean;
  };
}

/**
 * Computed from the subscriptions table on every call. Clients display this but are never
 * the authority: model downloads and premium endpoints re-check it server-side.
 */
export async function getEntitlements(q: Queryable, userId: string): Promise<Entitlements> {
  const sub = (
    await q.query<{ current_period_end: Date }>(
      `select current_period_end from subscriptions
        where user_id = $1 and status in ('active', 'past_due') and current_period_end > now()`,
      [userId],
    )
  ).rows[0];
  const premium = sub !== undefined;
  return {
    tier: premium ? 'premium' : 'free',
    renewsAt: sub?.current_period_end.toISOString() ?? null,
    features: {
      allFaces: premium,
      allVoices: premium,
      customFaces: premium,
      voiceCloning: premium,
    },
  };
}
