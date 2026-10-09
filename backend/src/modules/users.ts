import type { Queryable } from '../db/client.js';

const PAGE_SIZE = 50;

/** Most recent accounts first, each with its active sanction if it has one. */
export async function listUsers(q: Queryable, filter: { search: string; bannedOnly: boolean }) {
  const { rows } = await q.query<{
    id: string;
    email: string;
    role: 'user' | 'admin';
    verified: boolean;
    premium: boolean;
    created_at: Date;
    last_seen_at: Date | null;
    ban_kind: 'ban' | 'suspension' | null;
    ban_reason: string | null;
    ban_expires_at: Date | null;
  }>(
    `select u.id, u.email, u.role, u.created_at,
            u.email_verified_at is not null as verified,
            exists (select 1 from subscriptions p
                     where p.user_id = u.id and p.status in ('active', 'past_due')
                       and p.current_period_end > now()) as premium,
            (select max(s.last_seen_at) from sessions s where s.user_id = u.id) as last_seen_at,
            b.kind as ban_kind, b.reason as ban_reason, b.expires_at as ban_expires_at
       from users u
       left join lateral (
         select kind, reason, expires_at from bans
          where user_id = u.id and lifted_at is null and (expires_at is null or expires_at > now())
          order by expires_at desc nulls first limit 1
       ) b on true
      where u.deleted_at is null
        and position(lower($1::text) in lower(u.email)) > 0
        and ($2::boolean is not true or b.kind is not null)
      order by u.created_at desc limit ${PAGE_SIZE}`,
    [filter.search, filter.bannedOnly],
  );
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    verified: row.verified,
    premium: row.premium,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    ban: row.ban_kind && {
      kind: row.ban_kind,
      reason: row.ban_reason,
      until: row.ban_expires_at,
    },
  }));
}
