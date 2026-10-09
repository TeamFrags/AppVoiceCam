import type { Queryable } from '../db/client.js';
import type { Deps, RequestMeta } from '../deps.js';
import { HttpError } from '../errors.js';

export interface ActiveBan {
  kind: 'ban' | 'suspension';
  reason: string;
  expires_at: Date | null;
}

export async function findActiveBan(q: Queryable, userId: string): Promise<ActiveBan | undefined> {
  const { rows } = await q.query<ActiveBan>(
    `select kind, reason, expires_at from bans
      where user_id = $1 and lifted_at is null and (expires_at is null or expires_at > now())
      order by expires_at desc nulls first limit 1`,
    [userId],
  );
  return rows[0];
}

export async function assertNotBanned(q: Queryable, userId: string): Promise<void> {
  const ban = await findActiveBan(q, userId);
  if (ban) {
    throw new HttpError(403, 'account_banned', {
      kind: ban.kind,
      reason: ban.reason,
      until: ban.expires_at?.toISOString() ?? null,
    });
  }
}

export async function banUser(
  deps: Deps,
  adminId: string,
  input: { userId: string; kind: 'ban' | 'suspension'; reason: string; durationHours?: number },
  meta: RequestMeta,
): Promise<void> {
  if (input.userId === adminId) throw new HttpError(400, 'cannot_ban_self');
  await deps.db.tx(async (q) => {
    const target = (
      await q.query<{ role: string }>(
        'select role from users where id = $1 and deleted_at is null',
        [input.userId],
      )
    ).rows[0];
    if (!target) throw new HttpError(404, 'user_not_found');
    if (target.role === 'admin') throw new HttpError(403, 'cannot_ban_admin');

    await q.query(
      `insert into bans (user_id, kind, reason, created_by, expires_at)
       values ($1, $2, $3, $4, now() + make_interval(hours => $5::int))`,
      [input.userId, input.kind, input.reason, adminId, input.durationHours ?? null],
    );
    await q.query(
      `update sessions set revoked_at = now(), revoke_reason = 'banned'
        where user_id = $1 and revoked_at is null`,
      [input.userId],
    );
    await q.query(
      `insert into audit_log (actor_id, action, target_type, target_id, metadata, ip)
       values ($1, $2, 'user', $3, $4, $5)`,
      [
        adminId,
        `user.${input.kind}`,
        input.userId,
        JSON.stringify({ reason: input.reason, durationHours: input.durationHours ?? null }),
        meta.ip,
      ],
    );
  });
}

export async function unbanUser(
  deps: Deps,
  adminId: string,
  userId: string,
  meta: RequestMeta,
): Promise<void> {
  await deps.db.tx(async (q) => {
    const { rows } = await q.query(
      `update bans set lifted_at = now(), lifted_by = $2
        where user_id = $1 and lifted_at is null and (expires_at is null or expires_at > now())
        returning id`,
      [userId, adminId],
    );
    if (rows.length === 0) throw new HttpError(404, 'no_active_ban');
    await q.query(
      `insert into audit_log (actor_id, action, target_type, target_id, ip)
       values ($1, 'user.unban', 'user', $2, $3)`,
      [adminId, userId, meta.ip],
    );
  });
}
