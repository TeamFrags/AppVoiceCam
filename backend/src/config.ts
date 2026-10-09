import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().optional(),
  // Where the embedded development database lives when DATABASE_URL is not set. Automated
  // tests point this at a temporary folder so they never touch the developer's local data.
  DEV_DATA_DIR: z.string().optional(),
  REDIS_URL: z.string().optional(),
  JWT_PRIVATE_KEY: z.string().optional(),
  JWT_ISSUER: z.string().default('http://localhost:4000'),
  ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(600),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  // Product name shown in emails. Set from the environment so a rebrand needs no code change.
  APP_NAME: z.string().default('App'),
  // Google and Discord sign-in. A provider is offered only when both of its values are set.
  // Redirect URI to declare at the provider: <JWT_ISSUER>/v1/auth/oauth/<provider>/callback
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type Config = z.infer<typeof schema>;

const REQUIRED_IN_PRODUCTION = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_PRIVATE_KEY',
  'SMTP_URL',
  'MAIL_FROM',
] as const;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // An empty line such as `GOOGLE_CLIENT_ID=` in an env file means "not set".
  const defined = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
  const config = schema.parse(defined);
  if (config.NODE_ENV === 'production') {
    const missing: string[] = REQUIRED_IN_PRODUCTION.filter((key) => !config[key]);
    // The development defaults for these would put localhost links in real emails.
    for (const key of ['JWT_ISSUER', 'WEB_URL', 'APP_NAME'] as const) {
      if (!defined[key]) missing.push(key);
    }
    if (missing.length > 0) {
      throw new Error(`Missing required production settings: ${missing.join(', ')}`);
    }
  }
  return config;
}
