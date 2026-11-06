import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { requireAuth } from './auth/plugin';
import { type Clock, createTokenService } from './auth/tokens';
import type { Database } from './db/client';
import { registerErrorHandling } from './lib/errors';
import { registerAuthRoutes } from './routes/auth';
import { registerHealthRoute } from './routes/health';
import { registerMeRoutes } from './routes/me';

/**
 * Trust exactly `hops` proxies: the client address is the X-Forwarded-For entry that the
 * outermost trusted proxy appended, so entries a client adds itself are ignored.
 * A function rather than a number because Fastify 5 treats a numeric trustProxy as
 * "trust nothing" (it would make every request look like it came from Render's proxy).
 */
export function trustProxyHops(hops: number) {
  return (_address: string, hopIndex: number) => hopIndex < hops;
}

/** Largest JSON body accepted. The biggest request (settings with 20 custom reminders) is a few KB. */
export const BODY_LIMIT_BYTES = 32 * 1024;

export type RateLimit = { max: number; timeWindow: number };

export const DEFAULT_RATE_LIMITS = {
  /** Auth routes, per IP. */
  auth: { max: 10, timeWindow: 60_000 },
  /** Everything else, per user. */
  user: { max: 120, timeWindow: 60_000 },
} satisfies Record<string, RateLimit>;

/**
 * Pino options for the API. Fastify's default serializers log only method, url, host, remote
 * address and status code, never headers or bodies; the redaction list is a second line of defence.
 */
export function loggerOptions(stream?: NodeJS.WritableStream) {
  return {
    level: 'info',
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body',
        'body',
        'password',
        'passwordHash',
        'accessToken',
        'refreshToken',
        '*.password',
        '*.passwordHash',
        '*.accessToken',
        '*.refreshToken',
      ],
      censor: '[redacted]',
    },
    ...(stream ? { stream } : {}),
  };
}

export type AppDeps = {
  pingDb: () => Promise<void>;
  /** Required, with jwtSecret, for every route except /health. */
  db?: Database;
  jwtSecret?: string;
  clock?: Clock;
  rateLimits?: { auth?: RateLimit; user?: RateLimit };
  logger?: FastifyServerOptions['logger'];
  /** Set on Render, which sits behind a proxy, so per-IP limits see the client's address. */
  trustProxy?: FastifyServerOptions['trustProxy'];
};

export function buildApp({
  pingDb,
  db,
  jwtSecret,
  clock = () => new Date(),
  rateLimits = {},
  logger = false,
  trustProxy = false,
}: AppDeps) {
  const app = Fastify({ logger, trustProxy, bodyLimit: BODY_LIMIT_BYTES });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandling(app);

  app.register(helmet);
  app.register(sensible);

  registerHealthRoute(app, pingDb);

  if (db && jwtSecret) {
    const tokens = createTokenService({ db, jwtSecret, clock });
    const authLimit = rateLimits.auth ?? DEFAULT_RATE_LIMITS.auth;
    const userLimit = rateLimits.user ?? DEFAULT_RATE_LIMITS.user;

    app.register(async (scope) => {
      await scope.register(rateLimit, { ...authLimit, keyGenerator: (request) => request.ip });
      registerAuthRoutes(scope, { db, tokens });
    });

    app.register(async (scope) => {
      requireAuth(scope, tokens);
      // preHandler: runs after the guard has set request.userId.
      await scope.register(rateLimit, {
        ...userLimit,
        hook: 'preHandler',
        keyGenerator: (request) => `user:${request.userId}`,
      });
      registerMeRoutes(scope, { db, clock });
    });
  } else if (db || jwtSecret) {
    throw new Error('buildApp needs both db and jwtSecret to serve the API routes.');
  }

  return app;
}
