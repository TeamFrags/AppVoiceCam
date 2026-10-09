import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { ZodError } from 'zod';
import type { Deps } from './deps.js';
import { HttpError } from './errors.js';
import { registerRoutes } from './routes.js';

export async function buildApp(deps: Deps): Promise<FastifyInstance> {
  const app = Fastify({
    trustProxy: deps.config.TRUST_PROXY,
    bodyLimit: 16 * 1024,
    logger:
      deps.config.NODE_ENV === 'test'
        ? false
        : { redact: ['req.headers.authorization', 'req.headers.cookie'] },
  });
  await app.register(helmet);
  // The website is served from another origin (static hosting) and calls this API from the
  // browser. Only that origin is allowed; tokens travel in the Authorization header, not cookies.
  // In development the site moves to the next free port when 3000 is taken, so any local port
  // is accepted there.
  const webOrigin = new URL(deps.config.WEB_URL).origin;
  await app.register(cors, {
    origin:
      deps.config.NODE_ENV === 'development'
        ? [webOrigin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/]
        : webOrigin,
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['authorization', 'content-type'],
    // Lets the browser send the HttpOnly refresh cookie on calls from the website.
    credentials: true,
    maxAge: 600,
  });
  await app.register(cookie);

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) {
      if (typeof err.details.retryAfter === 'number') {
        reply.header('retry-after', err.details.retryAfter);
      }
      return reply.code(err.status).send({ error: err.code, ...err.details });
    }
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: 'invalid_request',
        fields: err.issues.map((i) => i.path.join('.')),
      });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply.code(status).send({ error: 'bad_request' });
    }
    req.log.error(err);
    return reply.code(500).send({ error: 'internal_error' });
  });

  registerRoutes(app, deps);
  return app;
}
