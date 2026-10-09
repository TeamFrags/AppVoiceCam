import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadConfig, type Config } from './config.js';
import { createPgDb, createPgliteDb, type Db } from './db/client.js';
import type { Deps } from './deps.js';
import { createMemoryKv, createRedisKv } from './kv.js';
import { createConsoleMailer, createSmtpMailer, type Mailer } from './mailer.js';
import { createOAuthProviders } from './modules/auth/oauth.js';
import { createTokenService } from './security/tokens.js';

export function createDb(config: Config): Db {
  if (config.DATABASE_URL) return createPgDb(config.DATABASE_URL);
  const dataDir = config.DEV_DATA_DIR ?? fileURLToPath(new URL('../.data/pg', import.meta.url));
  // PGlite creates its data directory but not the parents.
  mkdirSync(dataDir, { recursive: true });
  return createPgliteDb(dataDir);
}

function createMailer(config: Config): Mailer {
  if (config.SMTP_URL && config.MAIL_FROM) {
    return createSmtpMailer({
      url: config.SMTP_URL,
      from: config.MAIL_FROM,
      appName: config.APP_NAME,
    });
  }
  // loadConfig guarantees SMTP in production, so links are never printed to production logs.
  return createConsoleMailer();
}

export function createDeps(config: Config = loadConfig()): Deps {
  return {
    config,
    db: createDb(config),
    kv: config.REDIS_URL ? createRedisKv(config.REDIS_URL) : createMemoryKv(),
    mailer: createMailer(config),
    oauth: createOAuthProviders(config),
    tokens: createTokenService({
      privateKeyPem: config.JWT_PRIVATE_KEY,
      issuer: config.JWT_ISSUER,
      ttlSec: config.ACCESS_TOKEN_TTL_SEC,
    }),
  };
}
