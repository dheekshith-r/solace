import {
  authResponseSchema,
  loginRequestSchema,
  logoutRequestSchema,
  refreshRequestSchema,
  refreshResponseSchema,
  signupRequestSchema,
} from '@solace/shared';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../auth/passwords';
import type { TokenService } from '../auth/tokens';
import type { Database } from '../db/client';
import { userSettings, users } from '../db/schema';
import { ApiError } from '../lib/errors';
import { toUser } from '../lib/users';

const invalidCredentials = () =>
  new ApiError(401, 'invalid_credentials', 'Email or password is incorrect.');
const invalidRefresh = () =>
  new ApiError(401, 'invalid_refresh_token', 'Your session has ended. Sign in again.');

export function registerAuthRoutes(
  scope: FastifyInstance,
  { db, tokens }: { db: Database; tokens: TokenService },
) {
  const app = scope.withTypeProvider<ZodTypeProvider>();

  app.post(
    '/auth/signup',
    { schema: { body: signupRequestSchema, response: { 201: authResponseSchema } } },
    async (request, reply) => {
      const { email, password, name, goal, timezone, reminders } = request.body;
      const passwordHash = await hashPassword(password);

      const user = await db.transaction(async (tx) => {
        // ON CONFLICT instead of catching a unique violation: the driver error would carry the hash.
        const [created] = await tx
          .insert(users)
          .values({ email, passwordHash, name, isAdult: true, goal, timezone })
          .onConflictDoNothing({ target: users.email })
          .returning();
        if (!created) return null;
        if (reminders) await tx.insert(userSettings).values({ userId: created.id, reminders });
        return created;
      });
      if (!user) throw new ApiError(409, 'email_taken', 'An account with this email already exists.');

      const pair = await tokens.issuePair(user.id);
      return reply.code(201).send({ user: toUser(user), ...pair });
    },
  );

  app.post(
    '/auth/login',
    { schema: { body: loginRequestSchema, response: { 200: authResponseSchema } } },
    async (request) => {
      const { email, password } = request.body;
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user) {
        await burnPasswordCheck(password);
        throw invalidCredentials();
      }
      if (!(await verifyPassword(user.passwordHash, password))) throw invalidCredentials();

      const pair = await tokens.issuePair(user.id);
      return { user: toUser(user), ...pair };
    },
  );

  app.post(
    '/auth/refresh',
    { schema: { body: refreshRequestSchema, response: { 200: refreshResponseSchema } } },
    async (request) => {
      const pair = await tokens.rotate(request.body.refreshToken);
      if (!pair) throw invalidRefresh();
      return pair;
    },
  );

  app.post('/auth/logout', { schema: { body: logoutRequestSchema } }, async (request, reply) => {
    await tokens.revoke(request.body.refreshToken);
    return reply.code(204).send();
  });
}
