import type { FastifyRequest } from 'fastify';
import type { Deps, RequestMeta } from './deps.js';
import { HttpError } from './errors.js';
import { assertNotBanned } from './modules/bans.js';

export interface AuthContext {
  userId: string;
  sessionId: string;
  email: string;
  role: 'user' | 'admin';
}

export function requestMeta(req: FastifyRequest): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

/** Fixed-window limiter keyed by client IP. */
export async function rateLimit(
  deps: Deps,
  req: FastifyRequest,
  bucket: string,
  limit: number,
  windowSec: number,
): Promise<void> {
  const key = `rl:${bucket}:${req.ip}`;
  if ((await deps.kv.incr(key, windowSec)) > limit) {
    throw new HttpError(429, 'rate_limited', { retryAfter: await deps.kv.ttl(key) });
  }
}

/**
 * Resolves the caller from the bearer token. The signature alone is never trusted: session
 * revocation, bans and the role are re-read from the database on every request, so they
 * take effect immediately instead of when the access token expires.
 */
export async function authenticate(deps: Deps, req: FastifyRequest): Promise<AuthContext> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'missing_token');

  let claims;
  try {
    claims = await deps.tokens.verifyAccess(header.slice('Bearer '.length));
  } catch {
    throw new HttpError(401, 'invalid_token');
  }

  const row = (
    await deps.db.query<{ email: string; role: 'user' | 'admin'; live: boolean }>(
      `select u.email, u.role, (s.revoked_at is null and s.expires_at > now()) as live
         from sessions s join users u on u.id = s.user_id
        where s.id = $1 and u.id = $2 and u.deleted_at is null`,
      [claims.sessionId, claims.userId],
    )
  ).rows[0];
  if (!row) throw new HttpError(401, 'invalid_token');

  // Checked before session liveness so a banned user is told why, not just signed out.
  await assertNotBanned(deps.db, claims.userId);
  if (!row.live) throw new HttpError(401, 'session_revoked');

  return { userId: claims.userId, sessionId: claims.sessionId, email: row.email, role: row.role };
}

export async function authenticateAdmin(deps: Deps, req: FastifyRequest): Promise<AuthContext> {
  const auth = await authenticate(deps, req);
  if (auth.role !== 'admin') throw new HttpError(403, 'forbidden');
  return auth;
}
