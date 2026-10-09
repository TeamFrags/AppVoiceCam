import type { Queryable } from '../../db/client.js';
import type { Deps, RequestMeta } from '../../deps.js';
import { HttpError } from '../../errors.js';
import { hashPassword, verifyPassword } from '../../security/password.js';
import { generateOpaqueToken, sha256 } from '../../security/tokens.js';
import { assertNotBanned } from '../bans.js';

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_SEC = 15 * 60;
const VERIFY_EMAIL_TTL_HOURS = 24;
const RESET_PASSWORD_TTL_HOURS = 1;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function recordSecurityEvent(
  q: Queryable,
  type: string,
  userId: string | null,
  meta: RequestMeta,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await q.query(
    'insert into security_events (user_id, type, ip, user_agent, metadata) values ($1, $2, $3, $4, $5)',
    [userId, type, meta.ip, meta.userAgent ?? null, JSON.stringify(metadata)],
  );
}

async function issueOneTimeToken(
  q: Queryable,
  userId: string,
  purpose: 'verify_email' | 'reset_password',
  ttlHours: number,
): Promise<string> {
  const token = generateOpaqueToken();
  // A new link supersedes any earlier one for the same purpose.
  await q.query(
    'update one_time_tokens set consumed_at = now() where user_id = $1 and purpose = $2 and consumed_at is null',
    [userId, purpose],
  );
  await q.query(
    `insert into one_time_tokens (user_id, purpose, token_hash, expires_at)
     values ($1, $2, $3, now() + make_interval(hours => $4::int))`,
    [userId, purpose, sha256(token), ttlHours],
  );
  return token;
}

async function consumeOneTimeToken(
  q: Queryable,
  token: string,
  purpose: 'verify_email' | 'reset_password',
): Promise<string> {
  const { rows } = await q.query<{ user_id: string }>(
    `update one_time_tokens set consumed_at = now()
      where token_hash = $1 and purpose = $2 and consumed_at is null and expires_at > now()
      returning user_id`,
    [sha256(token), purpose],
  );
  if (!rows[0]) throw new HttpError(400, 'invalid_or_expired_token');
  return rows[0].user_id;
}

async function insertRefreshToken(deps: Deps, q: Queryable, sessionId: string): Promise<string> {
  const token = generateOpaqueToken();
  await q.query(
    `insert into refresh_tokens (session_id, token_hash, expires_at)
     values ($1, $2, now() + make_interval(days => $3::int))`,
    [sessionId, sha256(token), deps.config.REFRESH_TOKEN_TTL_DAYS],
  );
  return token;
}

/**
 * Always resolves the same way whether or not the email is already registered, so the
 * endpoint cannot be used to enumerate accounts. The difference is only visible by email.
 */
export async function register(
  deps: Deps,
  input: { email: string; password: string },
): Promise<void> {
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const { rows } = await deps.db.query<{ id: string }>(
    'insert into users (email, password_hash) values ($1, $2) on conflict (email) do nothing returning id',
    [email, passwordHash],
  );
  const created = rows[0];
  if (!created) {
    await deps.mailer.send({ to: email, template: 'account_exists', data: {} });
    return;
  }
  const token = await issueOneTimeToken(
    deps.db,
    created.id,
    'verify_email',
    VERIFY_EMAIL_TTL_HOURS,
  );
  await deps.mailer.send({
    to: email,
    template: 'verify_email',
    data: { url: `${deps.config.WEB_URL}/verify-email?token=${token}` },
  });
}

export async function verifyEmail(deps: Deps, token: string): Promise<void> {
  await deps.db.tx(async (q) => {
    const userId = await consumeOneTimeToken(q, token, 'verify_email');
    await q.query(
      'update users set email_verified_at = coalesce(email_verified_at, now()), updated_at = now() where id = $1',
      [userId],
    );
  });
}

export async function login(
  deps: Deps,
  input: { email: string; password: string; deviceName: string },
  meta: RequestMeta,
): Promise<TokenPair> {
  const email = normalizeEmail(input.email);
  const emailKey = sha256(email);
  const lockKey = `auth:lock:${emailKey}`;
  const failKey = `auth:fail:${emailKey}`;

  const lockedFor = await deps.kv.ttl(lockKey);
  if (lockedFor > 0) throw new HttpError(429, 'account_locked', { retryAfter: lockedFor });

  const user = // password_hash is null for accounts created through Google or Discord.
    (
      await deps.db.query<{
        id: string;
        password_hash: string | null;
        email_verified_at: Date | null;
      }>(
        'select id, password_hash, email_verified_at from users where email = $1 and deleted_at is null',
        [email],
      )
    ).rows[0];

  if (!(await verifyPassword(user?.password_hash ?? undefined, input.password))) {
    const failures = await deps.kv.incr(failKey, LOCKOUT_SEC);
    if (failures >= MAX_FAILED_LOGINS) {
      await deps.kv.set(lockKey, '1', LOCKOUT_SEC);
      await deps.kv.del(failKey);
      await recordSecurityEvent(deps.db, 'login_lockout', user?.id ?? null, meta);
    }
    throw new HttpError(401, 'invalid_credentials');
  }
  if (!user) throw new HttpError(401, 'invalid_credentials');

  await assertNotBanned(deps.db, user.id);
  if (!user.email_verified_at) throw new HttpError(403, 'email_not_verified');
  await deps.kv.del(failKey);

  return startSession(deps, { id: user.id, email }, input.deviceName, meta);
}

/** Opens a session for a user whose identity has already been established. */
export async function startSession(
  deps: Deps,
  user: { id: string; email: string },
  deviceName: string,
  meta: RequestMeta,
): Promise<TokenPair> {
  const { email } = user;
  const { sessionId, refreshToken, unfamiliar } = await deps.db.tx(async (q) => {
    const known = await q.query<{ familiar: boolean }>(
      `select bool_or(ip = $2) as familiar from sessions where user_id = $1 having count(*) > 0`,
      [user.id, meta.ip],
    );
    const session = (
      await q.query<{ id: string }>(
        `insert into sessions (user_id, device_name, user_agent, ip, expires_at)
         values ($1, $2, $3, $4, now() + make_interval(days => $5::int)) returning id`,
        [user.id, deviceName, meta.userAgent ?? null, meta.ip, deps.config.REFRESH_TOKEN_TTL_DAYS],
      )
    ).rows[0]!;
    return {
      sessionId: session.id,
      refreshToken: await insertRefreshToken(deps, q, session.id),
      unfamiliar: known.rows[0]?.familiar === false,
    };
  });

  if (unfamiliar) {
    await recordSecurityEvent(deps.db, 'login_from_new_ip', user.id, meta, { sessionId });
    await deps.mailer.send({
      to: email,
      template: 'new_login',
      data: { deviceName, ip: meta.ip },
    });
  }

  return {
    accessToken: await deps.tokens.signAccess({ userId: user.id, sessionId }),
    refreshToken,
    expiresIn: deps.config.ACCESS_TOKEN_TTL_SEC,
  };
}

/**
 * Rotates a refresh token. Presenting a token that was already rotated means it was copied
 * (by an attacker or by the legitimate client after theft), so the whole session is revoked.
 */
export async function refresh(
  deps: Deps,
  refreshToken: string,
  meta: RequestMeta,
): Promise<TokenPair> {
  type Outcome =
    | { ok: true; userId: string; sessionId: string; refreshToken: string }
    | { ok: false; reused?: { userId: string; sessionId: string } };

  const outcome = await deps.db.tx<Outcome>(async (q) => {
    const row = (
      await q.query<{
        id: string;
        used_at: Date | null;
        token_live: boolean;
        session_id: string;
        session_live: boolean;
        user_id: string;
      }>(
        `select t.id, t.used_at, t.expires_at > now() as token_live, s.id as session_id,
                (s.revoked_at is null and s.expires_at > now()) as session_live, s.user_id
           from refresh_tokens t
           join sessions s on s.id = t.session_id
           join users u on u.id = s.user_id and u.deleted_at is null
          where t.token_hash = $1
            for update of t`,
        [sha256(refreshToken)],
      )
    ).rows[0];
    if (!row || !row.session_live || !row.token_live) return { ok: false };

    if (row.used_at) {
      await q.query(
        `update sessions set revoked_at = now(), revoke_reason = 'refresh_token_reuse' where id = $1`,
        [row.session_id],
      );
      return { ok: false, reused: { userId: row.user_id, sessionId: row.session_id } };
    }

    await assertNotBanned(q, row.user_id);
    await q.query('update refresh_tokens set used_at = now() where id = $1', [row.id]);
    await q.query('update sessions set last_seen_at = now(), ip = $2 where id = $1', [
      row.session_id,
      meta.ip,
    ]);
    return {
      ok: true,
      userId: row.user_id,
      sessionId: row.session_id,
      refreshToken: await insertRefreshToken(deps, q, row.session_id),
    };
  });

  if (!outcome.ok) {
    if (outcome.reused) {
      await recordSecurityEvent(deps.db, 'refresh_token_reuse', outcome.reused.userId, meta, {
        sessionId: outcome.reused.sessionId,
      });
    }
    throw new HttpError(401, 'invalid_refresh_token');
  }
  return {
    accessToken: await deps.tokens.signAccess({
      userId: outcome.userId,
      sessionId: outcome.sessionId,
    }),
    refreshToken: outcome.refreshToken,
    expiresIn: deps.config.ACCESS_TOKEN_TTL_SEC,
  };
}

/** Revokes one of the user's sessions. Returns false if it was not theirs or already revoked. */
export async function revokeSession(
  q: Queryable,
  userId: string,
  sessionId: string,
  reason: string,
): Promise<boolean> {
  const { rows } = await q.query(
    `update sessions set revoked_at = now(), revoke_reason = $3
      where id = $1 and user_id = $2 and revoked_at is null returning id`,
    [sessionId, userId, reason],
  );
  return rows.length > 0;
}

export async function listSessions(q: Queryable, userId: string) {
  const { rows } = await q.query<{
    id: string;
    device_name: string;
    ip: string | null;
    created_at: Date;
    last_seen_at: Date;
  }>(
    `select id, device_name, ip, created_at, last_seen_at from sessions
      where user_id = $1 and revoked_at is null and expires_at > now()
      order by last_seen_at desc`,
    [userId],
  );
  return rows;
}

/** Responds identically for unknown emails; see `register`. */
export async function requestPasswordReset(deps: Deps, emailInput: string): Promise<void> {
  const email = normalizeEmail(emailInput);
  const user = (
    await deps.db.query<{ id: string }>(
      'select id from users where email = $1 and deleted_at is null',
      [email],
    )
  ).rows[0];
  if (!user) return;
  const token = await issueOneTimeToken(
    deps.db,
    user.id,
    'reset_password',
    RESET_PASSWORD_TTL_HOURS,
  );
  await deps.mailer.send({
    to: email,
    template: 'reset_password',
    data: { url: `${deps.config.WEB_URL}/reset-password?token=${token}` },
  });
}

export async function resetPassword(
  deps: Deps,
  input: { token: string; newPassword: string },
  meta: RequestMeta,
): Promise<void> {
  const passwordHash = await hashPassword(input.newPassword);
  const { userId, email } = await deps.db.tx(async (q) => {
    const userId = await consumeOneTimeToken(q, input.token, 'reset_password');
    // Receiving the reset link proves control of the mailbox, so it also verifies the address.
    const user = (
      await q.query<{ email: string }>(
        `update users set password_hash = $2, updated_at = now(),
                email_verified_at = coalesce(email_verified_at, now())
          where id = $1 returning email`,
        [userId, passwordHash],
      )
    ).rows[0]!;
    await q.query(
      `update sessions set revoked_at = now(), revoke_reason = 'password_reset'
        where user_id = $1 and revoked_at is null`,
      [userId],
    );
    return { userId, email: user.email };
  });
  await deps.kv.del(`auth:lock:${sha256(email)}`);
  await recordSecurityEvent(deps.db, 'password_reset', userId, meta);
  await deps.mailer.send({ to: email, template: 'password_changed', data: {} });
}
