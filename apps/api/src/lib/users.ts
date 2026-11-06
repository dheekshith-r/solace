import type { User } from '@solace/shared';
import type { users } from '../db/schema';

type UserRow = typeof users.$inferSelect;

/** The public shape of a user. Never includes the password hash. */
export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    goal: row.goal,
    personalize: row.personalize,
    timezone: row.timezone,
    createdAt: row.createdAt.toISOString(),
  };
}
