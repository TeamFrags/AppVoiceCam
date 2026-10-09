import { createHash } from 'node:crypto';
import type { Deps, RequestMeta } from '../../deps.js';
import { HttpError } from '../../errors.js';
import { generateOpaqueToken, sha256 } from '../../security/tokens.js';
import { assertNotBanned } from '../bans.js';
import { startSession, type TokenPair } from './service.js';

export type ProviderName = 'google' | 'discord';

export interface OAuthProfile {
  providerUserId: string;
  email: string;
  /** Whether the provider itself has verified that the user owns this address. */
  emailVerified: boolean;
}

/** One sign-in provider. The real ones talk to Google and Discord; tests inject a fake. */
export interface OAuthProvider {
  authorizeUrl(params: { state: string; redirectUri: string; codeChallenge: string }): string;
  fetchProfile(params: {
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }): Promise<OAuthProfile>;
}

export type OAuthProviders = Partial<Record<ProviderName, OAuthProvider>>;

const STATE_TTL_SEC = 600;
const DESKTOP_CODE_TTL_SEC = 120;

const s256 = (value: string) => createHash('sha256').update(value).digest('base64url');

function standardProvider(spec: {
  clientId: string;
  clientSecret: string;
  authorizeEndpoint: string;
  tokenEndpoint: string;
  userEndpoint: string;
  scope: string;
  toProfile(user: Record<string, unknown>): OAuthProfile;
}): OAuthProvider {
  return {
    authorizeUrl({ state, redirectUri, codeChallenge }) {
      const url = new URL(spec.authorizeEndpoint);
      url.search = new URLSearchParams({
        client_id: spec.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: spec.scope,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      }).toString();
      return url.toString();
    },
    async fetchProfile({ code, redirectUri, codeVerifier }) {
      const tokenRes = await fetch(spec.tokenEndpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: spec.clientId,
          client_secret: spec.clientSecret,
          code_verifier: codeVerifier,
        }),
      });
      if (!tokenRes.ok) throw new Error(`token endpoint answered ${tokenRes.status}`);
      const { access_token: accessToken } = (await tokenRes.json()) as { access_token?: string };
      if (!accessToken) throw new Error('no access token in provider response');

      const userRes = await fetch(spec.userEndpoint, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!userRes.ok) throw new Error(`user endpoint answered ${userRes.status}`);
      return spec.toProfile((await userRes.json()) as Record<string, unknown>);
    },
  };
}

export function createOAuthProviders(config: Deps['config']): OAuthProviders {
  const providers: OAuthProviders = {};
  if (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET) {
    providers.google = standardProvider({
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      authorizeEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      userEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
      scope: 'openid email',
      toProfile: (u) => ({
        providerUserId: String(u.sub ?? ''),
        email: String(u.email ?? ''),
        emailVerified: u.email_verified === true,
      }),
    });
  }
  if (config.DISCORD_CLIENT_ID && config.DISCORD_CLIENT_SECRET) {
    providers.discord = standardProvider({
      clientId: config.DISCORD_CLIENT_ID,
      clientSecret: config.DISCORD_CLIENT_SECRET,
      authorizeEndpoint: 'https://discord.com/oauth2/authorize',
      tokenEndpoint: 'https://discord.com/api/oauth2/token',
      userEndpoint: 'https://discord.com/api/users/@me',
      scope: 'identify email',
      toProfile: (u) => ({
        providerUserId: String(u.id ?? ''),
        email: String(u.email ?? ''),
        emailVerified: u.verified === true,
      }),
    });
  }
  return providers;
}

/** Where the flow started, so the callback knows where to send the user back. */
type Origin = { client: 'web' } | { client: 'desktop'; port: number; challenge: string };

interface PendingState {
  provider: ProviderName;
  origin: Origin;
  codeVerifier: string;
}

const callbackUrl = (deps: Deps, provider: ProviderName) =>
  `${deps.config.JWT_ISSUER}/v1/auth/oauth/${provider}/callback`;

function getProvider(deps: Deps, name: string): { name: ProviderName; provider: OAuthProvider } {
  const provider = deps.oauth[name as ProviderName];
  if (!provider) throw new HttpError(404, 'unknown_provider');
  return { name: name as ProviderName, provider };
}

/** Returns the provider URL to redirect the browser to. */
export async function beginOAuth(
  deps: Deps,
  providerName: string,
  origin: Origin,
): Promise<string> {
  const { name, provider } = getProvider(deps, providerName);
  const state = generateOpaqueToken();
  const codeVerifier = generateOpaqueToken();
  const pending: PendingState = { provider: name, origin, codeVerifier };
  await deps.kv.set(`oauth:state:${sha256(state)}`, JSON.stringify(pending), STATE_TTL_SEC);
  return provider.authorizeUrl({
    state,
    redirectUri: callbackUrl(deps, name),
    codeChallenge: s256(codeVerifier),
  });
}

/**
 * Finds or creates the account behind a provider identity. Only provider-verified emails are
 * accepted: otherwise anyone could claim somebody else's address at the provider and get in.
 */
async function resolveUser(
  deps: Deps,
  provider: ProviderName,
  profile: OAuthProfile,
): Promise<{ id: string; email: string }> {
  const email = profile.email.trim().toLowerCase();
  if (!profile.providerUserId || !email || !profile.emailVerified) {
    throw new HttpError(403, 'oauth_email_not_verified');
  }

  return deps.db.tx(async (q) => {
    const linked = (
      await q.query<{ id: string; email: string }>(
        `select u.id, u.email from oauth_identities i join users u on u.id = i.user_id
          where i.provider = $1 and i.provider_user_id = $2 and u.deleted_at is null`,
        [provider, profile.providerUserId],
      )
    ).rows[0];
    if (linked) return linked;

    const existing = (
      await q.query<{ id: string; email_verified_at: Date | null }>(
        'select id, email_verified_at from users where email = $1 and deleted_at is null',
        [email],
      )
    ).rows[0];

    let userId: string;
    if (!existing) {
      userId = (
        await q.query<{ id: string }>(
          'insert into users (email, email_verified_at) values ($1, now()) returning id',
          [email],
        )
      ).rows[0]!.id;
    } else {
      userId = existing.id;
      if (!existing.email_verified_at) {
        // Nobody ever proved ownership of this address here, so its password may have been
        // set by someone else hoping the real owner would sign up later. Discard it.
        await q.query(
          `update users set password_hash = null, email_verified_at = now(), updated_at = now()
            where id = $1`,
          [userId],
        );
        await q.query(
          `update sessions set revoked_at = now(), revoke_reason = 'oauth_takeover_protection'
            where user_id = $1 and revoked_at is null`,
          [userId],
        );
      }
    }
    await q.query(
      'insert into oauth_identities (provider, provider_user_id, user_id) values ($1, $2, $3)',
      [provider, profile.providerUserId, userId],
    );
    return { id: userId, email };
  });
}

export type OAuthOutcome =
  { client: 'web'; tokens: TokenPair } | { client: 'desktop'; port: number; code: string };

/** Handles the provider redirect. Throws HttpError; the route turns it into a redirect. */
export async function completeOAuth(
  deps: Deps,
  providerName: string,
  query: { state?: string; code?: string },
  meta: RequestMeta,
): Promise<OAuthOutcome> {
  const { name, provider } = getProvider(deps, providerName);
  const raw = query.state ? await deps.kv.take(`oauth:state:${sha256(query.state)}`) : null;
  const pending = raw ? (JSON.parse(raw) as PendingState) : null;
  if (!pending || pending.provider !== name || !query.code) {
    throw new HttpError(400, 'oauth_invalid_state');
  }

  let profile: OAuthProfile;
  try {
    profile = await provider.fetchProfile({
      code: query.code,
      redirectUri: callbackUrl(deps, name),
      codeVerifier: pending.codeVerifier,
    });
  } catch {
    throw new HttpError(502, 'oauth_provider_error');
  }

  const user = await resolveUser(deps, name, profile);
  await assertNotBanned(deps.db, user.id);

  if (pending.origin.client === 'web') {
    return { client: 'web', tokens: await startSession(deps, user, 'Navigateur web', meta) };
  }
  // The desktop app gets a short-lived code on its loopback port. The session is only created
  // when the app proves it started this flow (see exchangeDesktopCode).
  const code = generateOpaqueToken();
  await deps.kv.set(
    `oauth:code:${sha256(code)}`,
    JSON.stringify({ user, challenge: pending.origin.challenge }),
    DESKTOP_CODE_TTL_SEC,
  );
  return { client: 'desktop', port: pending.origin.port, code };
}

/**
 * Trades the loopback code for tokens. Another program on the PC could grab the code from the
 * loopback redirect, but not the verifier, which never left the app that started the flow.
 */
export async function exchangeDesktopCode(
  deps: Deps,
  input: { code: string; verifier: string; deviceName: string },
  meta: RequestMeta,
): Promise<TokenPair> {
  const raw = await deps.kv.take(`oauth:code:${sha256(input.code)}`);
  const pending = raw
    ? (JSON.parse(raw) as { user: { id: string; email: string }; challenge: string })
    : null;
  if (!pending || s256(input.verifier) !== pending.challenge) {
    throw new HttpError(400, 'oauth_invalid_code');
  }
  await assertNotBanned(deps.db, pending.user.id);
  return startSession(deps, pending.user, input.deviceName, meta);
}
