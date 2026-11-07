import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { type AiClient, unavailableAi } from './ai/client';
import { createDailyService } from './ai/daily';
import { requireAuth } from './auth/plugin';
import { type Clock, createTokenService } from './auth/tokens';
import type { Database } from './db/client';
import { type AiStats, createAiStats } from './lib/ai-stats';
import { type BackgroundTasks, createBackgroundTasks } from './lib/background';
import { registerErrorHandling } from './lib/errors';
import { registerAuthRoutes } from './routes/auth';
import { registerAiHealthRoute, registerHealthRoute } from './routes/health';
import { registerAssessmentRoutes } from './routes/assessments';
import { registerConversationRoutes } from './routes/conversations';
import { registerMeRoutes } from './routes/me';
import { type ChatTimeouts, DEFAULT_CHAT_TIMEOUTS, registerMessageRoutes } from './routes/messages';
import { registerResourcesRoute } from './routes/resources';
import { registerTodayRoutes } from './routes/today';

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
  /** Chat messages (each one is a model call), per user. Protects the Gemini quota. */
  messages: { max: 20, timeWindow: 60_000 },
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
  rateLimits?: { auth?: RateLimit; user?: RateLimit; messages?: RateLimit };
  /** Model provider. Without one every AI call fails and the handwritten fallbacks are used. */
  ai?: AiClient;
  /** Work that runs after a response (summaries). Drained when the app closes. */
  tasks?: BackgroundTasks;
  /** Aggregate reply-model counts served by GET /health/ai. */
  aiStats?: AiStats;
  chatTimeouts?: Partial<ChatTimeouts>;
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
  ai = unavailableAi,
  tasks = createBackgroundTasks(),
  aiStats = createAiStats(),
  chatTimeouts = {},
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
  registerAiHealthRoute(app, aiStats);
  registerResourcesRoute(app);
  app.addHook('onClose', async () => {
    await tasks.drain();
  });

  if (db && jwtSecret) {
    const tokens = createTokenService({ db, jwtSecret, clock });
    const authLimit = rateLimits.auth ?? DEFAULT_RATE_LIMITS.auth;
    const userLimit = rateLimits.user ?? DEFAULT_RATE_LIMITS.user;
    const messageLimit = rateLimits.messages ?? DEFAULT_RATE_LIMITS.messages;
    const daily = createDailyService({ db, ai, clock, tasks });

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
      registerMeRoutes(scope, { db, clock, daily });
      registerTodayRoutes(scope, { db, clock, daily });
      registerConversationRoutes(scope, { db });
      registerAssessmentRoutes(scope, { db, ai, clock });
      registerMessageRoutes(scope, {
        db,
        ai,
        tasks,
        aiStats,
        messageLimit,
        timeouts: { ...DEFAULT_CHAT_TIMEOUTS, ...chatTimeouts },
      });
    });
  } else if (db || jwtSecret) {
    throw new Error('buildApp needs both db and jwtSecret to serve the API routes.');
  }

  return app;
}
