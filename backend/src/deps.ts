import type { Config } from './config.js';
import type { Db } from './db/client.js';
import type { Kv } from './kv.js';
import type { Mailer } from './mailer.js';
import type { OAuthProviders } from './modules/auth/oauth.js';
import type { TokenService } from './security/tokens.js';

export interface Deps {
  config: Config;
  db: Db;
  kv: Kv;
  mailer: Mailer;
  tokens: TokenService;
  /** Sign-in providers that are configured. Empty when no OAuth credentials are set. */
  oauth: OAuthProviders;
}

/** Network context of a request, recorded on sessions and security events. */
export interface RequestMeta {
  ip: string;
  userAgent?: string;
}
