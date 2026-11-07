import type { ActivityKind } from '@solace/shared';
import { eq, sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import { activityLog, users } from '../db/schema';
import { unauthorized } from './errors';

type Executor = Pick<Database, 'insert' | 'update'>;

/**
 * Logs an activity and adds its XP to the user, atomically when given a transaction.
 * Returns the activity id and the user row with the new XP.
 */
export async function logActivity(
  executor: Executor,
  input: {
    userId: string;
    kind: ActivityKind;
    meta: Record<string, unknown>;
    xp: number;
    at: Date;
  },
) {
  const [activity] = await executor
    .insert(activityLog)
    .values({
      userId: input.userId,
      kind: input.kind,
      meta: input.meta,
      xpAwarded: input.xp,
      createdAt: input.at,
    })
    .returning({ id: activityLog.id });
  const [user] = await executor
    .update(users)
    .set({ xp: sql`${users.xp} + ${input.xp}` })
    .where(eq(users.id, input.userId))
    .returning();
  if (!activity || !user) throw unauthorized();
  return { activityId: activity.id, user };
}
