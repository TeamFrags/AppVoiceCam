import type { Queryable } from '../db/client.js';

// Not a deliverable address: this account can only be entered through /v1/dev/login.
export const DEV_ADMIN_EMAIL = 'admin@dev.local';

/**
 * The account `npm run dev:test` signs into. It has no password, so the regular login can
 * never open it; it exists only in databases where DEV_AUTO_LOGIN was once enabled.
 */
export async function ensureDevAdmin(q: Queryable): Promise<{ id: string; email: string }> {
  const { rows } = await q.query<{ id: string }>(
    `insert into users (email, role, email_verified_at) values ($1, 'admin', now())
     on conflict (email) do update
       set role = 'admin', deleted_at = null, updated_at = now(),
           email_verified_at = coalesce(users.email_verified_at, now())
     returning id`,
    [DEV_ADMIN_EMAIL],
  );
  return { id: rows[0]!.id, email: DEV_ADMIN_EMAIL };
}
