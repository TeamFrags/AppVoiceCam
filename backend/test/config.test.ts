import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { renderMail } from '../src/mailer.js';
import { createTestContext } from './helpers.js';

const production = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/db',
  REDIS_URL: 'redis://127.0.0.1:6390',
  JWT_PRIVATE_KEY: 'pem',
  JWT_ISSUER: 'https://api.example.com',
  WEB_URL: 'https://example.com',
  APP_NAME: 'Exemple',
  SMTP_URL: 'smtps://user:pass@smtp.example.com:465',
  MAIL_FROM: 'Exemple <no-reply@example.com>',
};

describe('production configuration', () => {
  it('treats an empty value in the env file as not set', () => {
    const config = loadConfig({ ...production, GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' });
    expect(config.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(() => loadConfig({ ...production, SMTP_URL: '' })).toThrow('SMTP_URL');
  });

  it('accepts a complete configuration', () => {
    expect(loadConfig(production).APP_NAME).toBe('Exemple');
  });

  it.each(Object.keys(production).filter((key) => key !== 'NODE_ENV'))(
    'refuses to start without %s',
    (key) => {
      const env: Record<string, string> = { ...production };
      delete env[key];
      expect(() => loadConfig(env)).toThrow(key);
    },
  );
});

describe('cross-origin access', () => {
  it('lets the website origin call the API from a browser, and no other origin', async () => {
    const ctx = await createTestContext();
    const preflight = (origin: string) =>
      ctx.app.inject({
        method: 'OPTIONS',
        url: '/v1/auth/login',
        headers: { origin, 'access-control-request-method': 'POST' },
      });
    const site = await preflight('http://localhost:3000');
    const other = await preflight('https://evil.example');
    await ctx.close();

    expect(site.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(other.headers['access-control-allow-origin']).not.toBe('https://evil.example');
  });
});

describe('mail rendering', () => {
  it('uses the configured product name and includes the link', () => {
    const mail = renderMail('Exemple', {
      template: 'verify_email',
      data: { url: 'https://example.com/verify-email?token=abc' },
    });
    expect(mail.subject).toContain('Exemple');
    expect(mail.text).toContain('https://example.com/verify-email?token=abc');
  });
});
