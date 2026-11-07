import {
  DEFAULT_REMINDERS,
  meResponseSchema,
  settingsRequestSchema,
  settingsResponseSchema,
  updateMeRequestSchema,
  updateMeResponseSchema,
} from '@solace/shared';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { DailyService } from '../ai/daily';
import type { Clock } from '../auth/tokens';
import type { Database } from '../db/client';
import { userSettings, users } from '../db/schema';
import { unauthorized } from '../lib/errors';
import { getStats } from '../lib/stats';
import { toUser } from '../lib/users';

/** Registered inside the auth-guarded scope: request.userId is always set. */
export function registerMeRoutes(
  scope: FastifyInstance,
  { db, clock, daily }: { db: Database; clock: Clock; daily: Pick<DailyService, 'forgetToday'> },
) {
  const app = scope.withTypeProvider<ZodTypeProvider>();

  async function loadUser(userId: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    // A valid token for a deleted account: the session is over.
    if (!user) throw unauthorized();
    return user;
  }

  app.get('/me', { schema: { response: { 200: meResponseSchema } } }, async (request) => {
    const user = await loadUser(request.userId);
    return { user: toUser(user), stats: await getStats(db, user, clock()) };
  });

  app.patch(
    '/me',
    { schema: { body: updateMeRequestSchema, response: { 200: updateMeResponseSchema } } },
    async (request) => {
      const changes = Object.fromEntries(
        Object.entries(request.body).filter(([, value]) => value !== undefined),
      );
      if (Object.keys(changes).length === 0) return { user: toUser(await loadUser(request.userId)) };

      const [user] = await db
        .update(users)
        .set(changes)
        .where(eq(users.id, request.userId))
        .returning();
      if (!user) throw unauthorized();
      // Turning personalize off drops today's lines that were written from personal history.
      // Clearing is idempotent, so it runs whenever personalize is set to false.
      if (changes.personalize === false) {
        try {
          await daily.forgetToday(user);
        } catch (error) {
          // Personalize is already saved; a failed cleanup must not turn that into a 500.
          const cause = (error as { cause?: { code?: unknown } }).cause;
          request.log.warn(
            { errName: error instanceof Error ? error.name : 'unknown', causeCode: cause?.code },
            'clearing personal daily lines failed',
          );
        }
      }
      return { user: toUser(user) };
    },
  );

  app.delete('/me', async (request, reply) => {
    // Every child table references users with ON DELETE CASCADE.
    await db.delete(users).where(eq(users.id, request.userId));
    return reply.code(204).send();
  });

  app.get(
    '/me/settings',
    { schema: { response: { 200: settingsResponseSchema } } },
    async (request) => {
      await loadUser(request.userId);
      const [row] = await db
        .select({ reminders: userSettings.reminders })
        .from(userSettings)
        .where(eq(userSettings.userId, request.userId))
        .limit(1);
      return { reminders: row?.reminders ?? DEFAULT_REMINDERS };
    },
  );

  app.put(
    '/me/settings',
    { schema: { body: settingsRequestSchema, response: { 200: settingsResponseSchema } } },
    async (request) => {
      await loadUser(request.userId);
      const { reminders } = request.body;
      const [row] = await db
        .insert(userSettings)
        .values({ userId: request.userId, reminders })
        .onConflictDoUpdate({
          target: userSettings.userId,
          set: { reminders, updatedAt: clock() },
        })
        .returning({ reminders: userSettings.reminders });
      return { reminders: row?.reminders ?? reminders };
    },
  );
}
