import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { Deps } from './deps.js';
import { HttpError } from './errors.js';
import { authenticate, authenticateAdmin, rateLimit, requestMeta } from './http.js';
import { countryFromHeader, pageViewReport, recordPageView } from './modules/analytics.js';
import { beginOAuth, completeOAuth, exchangeDesktopCode } from './modules/auth/oauth.js';
import * as auth from './modules/auth/service.js';
import { banUser, unbanUser } from './modules/bans.js';
import {
  CREATOR_PLATFORMS,
  listCreatorApplications,
  recordCreatorApplication,
} from './modules/creators.js';
import { ensureDevAdmin } from './modules/dev.js';
import { getEntitlements } from './modules/entitlements.js';
import { accountsReport, adminOverview } from './modules/stats.js';
import { listUsers } from './modules/users.js';

const email = z.string().trim().email().max(254);
const password = z.string().min(10).max(128);
const opaqueToken = z.string().min(20).max(200);
const uuid = z.string().uuid();

const registerBody = z.object({ email, password });
const loginBody = z.object({
  email,
  password: z.string().min(1).max(128),
  deviceName: z.string().trim().min(1).max(80).default('Appareil inconnu'),
  // Set by the website: the refresh token then travels in an HttpOnly cookie instead of JSON.
  web: z.boolean().default(false),
});
const tokenBody = z.object({ token: opaqueToken });
const refreshBody = z.object({ refreshToken: opaqueToken.optional() });
const pageViewBody = z.object({
  visitorId: uuid,
  // Pathname only: query strings can carry one-time tokens and must never be stored.
  path: z.string().regex(/^\/[^?#]{0,199}$/),
  referrerHost: z.string().max(255).optional(),
});
const creatorBody = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  platform: z.enum(CREATOR_PLATFORMS),
  channelUrl: z
    .string()
    .trim()
    .url()
    .max(300)
    .regex(/^https?:\/\//i),
  message: z.string().trim().max(1000).optional(),
  locale: z.string().max(10).optional(),
  // Hidden from people on the form: only a robot fills it in.
  website: z.string().max(300).optional(),
});
const reportQuery = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });

const deviceName = z.string().trim().min(1).max(80).default('Appareil inconnu');
const providerParams = z.object({ provider: z.string().max(20) });
const oauthStartQuery = z.discriminatedUnion('client', [
  z.object({ client: z.literal('web') }),
  z.object({
    client: z.literal('desktop'),
    port: z.coerce.number().int().min(1024).max(65535),
    // SHA-256 of the app's verifier, base64url.
    challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  }),
]);
const oauthCallbackQuery = z.object({
  state: z.string().max(200).optional(),
  code: z.string().max(2000).optional(),
});
const exchangeBody = z.object({
  code: opaqueToken,
  verifier: z.string().min(43).max(128),
  deviceName,
});

const devLoginBody = z.object({ deviceName, web: z.boolean().default(false) });

const REFRESH_COOKIE = 'rt';
const forgotBody = z.object({ email });
const resetBody = z.object({ token: opaqueToken, newPassword: password });
const banBody = z.object({
  kind: z.enum(['ban', 'suspension']),
  reason: z.string().trim().min(3).max(500),
  durationHours: z.number().int().positive().max(87600).optional(),
});
const idParams = z.object({ id: uuid });
const usersQuery = z.object({
  search: z.string().trim().max(254).default(''),
  banned: z.literal('1').optional(),
});

export function registerRoutes(app: FastifyInstance, deps: Deps): void {
  app.get('/health', async () => {
    await deps.db.query('select 1');
    return { status: 'ok' };
  });

  app.post('/v1/auth/register', async (req, reply) => {
    await rateLimit(deps, req, 'register', 10, 3600);
    await auth.register(deps, registerBody.parse(req.body));
    return reply.code(202).send({ status: 'verification_email_sent' });
  });

  app.post('/v1/auth/verify-email', async (req) => {
    await rateLimit(deps, req, 'verify-email', 20, 3600);
    await auth.verifyEmail(deps, tokenBody.parse(req.body).token);
    return { status: 'verified' };
  });

  // Scoped to the auth routes and unreadable from JavaScript, so a script injected into the
  // website cannot steal it. SameSite=Strict keeps other sites from triggering a refresh.
  const cookieOptions = {
    httpOnly: true,
    secure: deps.config.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/v1/auth',
  } as const;
  const sendWebTokens = (reply: FastifyReply, pair: auth.TokenPair) => {
    reply.setCookie(REFRESH_COOKIE, pair.refreshToken, {
      ...cookieOptions,
      maxAge: deps.config.REFRESH_TOKEN_TTL_DAYS * 86400,
    });
    return { accessToken: pair.accessToken, expiresIn: pair.expiresIn };
  };

  app.post('/v1/auth/login', async (req, reply) => {
    await rateLimit(deps, req, 'login', 20, 300);
    const { web, ...credentials } = loginBody.parse(req.body);
    const pair = await auth.login(deps, credentials, requestMeta(req));
    return web ? sendWebTokens(reply, pair) : pair;
  });

  // The route does not exist at all unless the server was started by `npm run dev:test`.
  if (deps.config.DEV_AUTO_LOGIN) {
    app.post('/v1/dev/login', async (req, reply) => {
      const { web, deviceName } = devLoginBody.parse(req.body ?? {});
      const admin = await ensureDevAdmin(deps.db);
      const pair = await auth.startSession(deps, admin, deviceName, requestMeta(req));
      return web ? sendWebTokens(reply, pair) : pair;
    });
  }

  app.post('/v1/auth/refresh', async (req, reply) => {
    await rateLimit(deps, req, 'refresh', 60, 300);
    const fromBody = refreshBody.parse(req.body ?? {}).refreshToken;
    const token = fromBody ?? req.cookies[REFRESH_COOKIE];
    if (!token) throw new HttpError(401, 'invalid_refresh_token');
    try {
      const pair = await auth.refresh(deps, token, requestMeta(req));
      return fromBody ? pair : sendWebTokens(reply, pair);
    } catch (err) {
      if (!fromBody) reply.clearCookie(REFRESH_COOKIE, cookieOptions);
      throw err;
    }
  });

  app.post('/v1/auth/logout', async (req, reply) => {
    const ctx = await authenticate(deps, req);
    await auth.revokeSession(deps.db, ctx.userId, ctx.sessionId, 'logout');
    return reply.clearCookie(REFRESH_COOKIE, cookieOptions).code(204).send();
  });

  app.get('/v1/auth/oauth/providers', async () => ({ providers: Object.keys(deps.oauth) }));

  app.get('/v1/auth/oauth/:provider/start', async (req, reply) => {
    await rateLimit(deps, req, 'oauth-start', 30, 300);
    const { provider } = providerParams.parse(req.params);
    return reply.redirect(await beginOAuth(deps, provider, oauthStartQuery.parse(req.query)));
  });

  app.get('/v1/auth/oauth/:provider/callback', async (req, reply) => {
    try {
      await rateLimit(deps, req, 'oauth-callback', 30, 300);
      const { provider } = providerParams.parse(req.params);
      const outcome = await completeOAuth(
        deps,
        provider,
        oauthCallbackQuery.parse(req.query),
        requestMeta(req),
      );
      if (outcome.client === 'web') {
        sendWebTokens(reply, outcome.tokens);
        return reply.redirect(`${deps.config.WEB_URL}/account/`);
      }
      // Only ever the loopback address, with a port the app chose: not an open redirect.
      return reply.redirect(`http://127.0.0.1:${outcome.port}/callback?code=${outcome.code}`);
    } catch (err) {
      // The user is looking at a browser tab: send them to the site with a reason, not raw JSON.
      if (!(err instanceof HttpError)) req.log.error(err);
      const reason = err instanceof HttpError ? err.code : 'oauth_failed';
      return reply.redirect(`${deps.config.WEB_URL}/login/?error=${encodeURIComponent(reason)}`);
    }
  });

  app.post('/v1/auth/oauth/exchange', async (req) => {
    await rateLimit(deps, req, 'oauth-exchange', 30, 300);
    return exchangeDesktopCode(deps, exchangeBody.parse(req.body), requestMeta(req));
  });

  app.post('/v1/analytics/pageview', async (req, reply) => {
    await rateLimit(deps, req, 'pageview', 120, 300);
    const country = countryFromHeader(req.headers['cf-ipcountry']);
    await recordPageView(deps.db, { ...pageViewBody.parse(req.body), country });
    return reply.code(204).send();
  });

  app.get('/v1/admin/analytics/pageviews', async (req) => {
    await authenticateAdmin(deps, req);
    return pageViewReport(deps.db, reportQuery.parse(req.query).days);
  });

  app.get('/v1/admin/analytics/accounts', async (req) => {
    await authenticateAdmin(deps, req);
    return accountsReport(deps.db, reportQuery.parse(req.query).days);
  });

  app.post('/v1/creators/apply', async (req, reply) => {
    await rateLimit(deps, req, 'creator-apply', 5, 3600);
    const parsed = creatorBody.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'invalid_application');
    const { website, ...application } = parsed.data;
    // A robot gets the same answer as a person, and nothing is stored.
    if (!website) await recordCreatorApplication(deps.db, application);
    return reply.code(202).send({ status: 'application_received' });
  });

  app.get('/v1/admin/creators/applications', async (req) => {
    await authenticateAdmin(deps, req);
    return { applications: await listCreatorApplications(deps.db) };
  });

  app.get('/v1/admin/overview', async (req) => {
    await authenticateAdmin(deps, req);
    return adminOverview(deps.db);
  });

  app.post('/v1/auth/password/forgot', async (req, reply) => {
    await rateLimit(deps, req, 'forgot', 5, 3600);
    await auth.requestPasswordReset(deps, forgotBody.parse(req.body).email);
    return reply.code(202).send({ status: 'reset_email_sent_if_account_exists' });
  });

  app.post('/v1/auth/password/reset', async (req) => {
    await rateLimit(deps, req, 'reset', 10, 3600);
    await auth.resetPassword(deps, resetBody.parse(req.body), requestMeta(req));
    return { status: 'password_updated' };
  });

  app.get('/v1/me', async (req) => {
    const ctx = await authenticate(deps, req);
    return { id: ctx.userId, email: ctx.email, role: ctx.role };
  });

  app.get('/v1/me/entitlements', async (req) => {
    const ctx = await authenticate(deps, req);
    return getEntitlements(deps.db, ctx.userId);
  });

  app.get('/v1/me/sessions', async (req) => {
    const ctx = await authenticate(deps, req);
    const sessions = await auth.listSessions(deps.db, ctx.userId);
    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        deviceName: s.device_name,
        ip: s.ip,
        createdAt: s.created_at,
        lastSeenAt: s.last_seen_at,
        current: s.id === ctx.sessionId,
      })),
    };
  });

  app.delete('/v1/me/sessions/:id', async (req, reply) => {
    const ctx = await authenticate(deps, req);
    const { id } = idParams.parse(req.params);
    if (!(await auth.revokeSession(deps.db, ctx.userId, id, 'revoked_by_user'))) {
      throw new HttpError(404, 'session_not_found');
    }
    return reply.code(204).send();
  });

  app.get('/v1/admin/users', async (req) => {
    await authenticateAdmin(deps, req);
    const { search, banned } = usersQuery.parse(req.query);
    return { users: await listUsers(deps.db, { search, bannedOnly: banned === '1' }) };
  });

  app.post('/v1/admin/users/:id/ban', async (req, reply) => {
    const ctx = await authenticateAdmin(deps, req);
    const { id } = idParams.parse(req.params);
    await banUser(deps, ctx.userId, { userId: id, ...banBody.parse(req.body) }, requestMeta(req));
    return reply.code(204).send();
  });

  app.post('/v1/admin/users/:id/unban', async (req, reply) => {
    const ctx = await authenticateAdmin(deps, req);
    const { id } = idParams.parse(req.params);
    await unbanUser(deps, ctx.userId, id, requestMeta(req));
    return reply.code(204).send();
  });
}
