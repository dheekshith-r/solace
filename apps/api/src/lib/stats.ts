import { XP_PER_LEVEL, type Stats } from '@solace/shared';
import { sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import { activityLog } from '../db/schema';

// A streak longer than this is reported as this; it bounds the query.
const MAX_STREAK_DAYS = 400;

export function levelForXp(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  return { level, xpToNext: level * XP_PER_LEVEL - xp };
}

/**
 * The calendar date ("YYYY-MM-DD") of an instant in an IANA time zone, for display.
 * Streaks use the Postgres computation in getStats instead, so they match the stored days.
 */
export function localDate(instant: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function previousDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Consecutive days with activity, counting back from today, or from yesterday when nothing
 * happened yet today (so the streak doesn't drop to zero in the morning).
 * `activeDays` are distinct local dates, newest first.
 */
export function computeStreak(activeDays: readonly string[], today: string): number {
  const days = new Set(activeDays);
  let cursor = days.has(today) ? today : previousDay(today);
  let streak = 0;
  while (days.has(cursor) && streak < MAX_STREAK_DAYS) {
    streak += 1;
    cursor = previousDay(cursor);
  }
  return streak;
}

/**
 * XP, level and streak. Both "today" and each activity's day are computed by Postgres in the
 * user's time zone, so they always agree. `now` is passed in (rather than SQL now()) so the
 * clock stays injectable in tests.
 */
export async function getStats(
  db: Database,
  user: { id: string; xp: number; timezone: string },
  now: Date,
): Promise<Stats> {
  const tz = user.timezone;
  const result = await db.execute<{ today: string; days: string[] }>(sql`
    select
      ((${now.toISOString()}::timestamptz at time zone ${tz})::date)::text as today,
      coalesce(
        (select array_agg(d.day::text order by d.day desc) from (
          select distinct (${activityLog.createdAt} at time zone ${tz})::date as day
          from ${activityLog}
          where ${activityLog.userId} = ${user.id}
          order by day desc
          limit ${MAX_STREAK_DAYS + 1}
        ) d),
        '{}'
      ) as days
  `);
  const row = result[0];
  if (!row) throw new Error('stats query returned no row');

  return {
    xp: user.xp,
    ...levelForXp(user.xp),
    streak: computeStreak(row.days, row.today),
  };
}
