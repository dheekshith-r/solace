import {
  ACTIVITY_XP,
  ACTIVITY_XP_DAILY_LIMIT,
  CHECKIN_XP_DAILY_LIMIT,
  activityRequestSchema,
  activityResponseSchema,
  checkinRequestSchema,
  checkinResponseSchema,
  HELPLINE,
  listCheckinsQuerySchema,
  listCheckinsResponseSchema,
  suggestionSchema,
  todayResponseSchema,
  type Checkin,
  type Suggestion,
} from '@solace/shared';
import { and, count, desc, eq, gt, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { DailyService, DailyUser } from '../ai/daily';
import { checkSafety, CRISIS_SUGGESTION } from '../ai/safety';
import type { Clock } from '../auth/tokens';
import type { Database } from '../db/client';
import { activityLog, dailyAffirmations, moodCheckins, users } from '../db/schema';
import { logActivity } from '../lib/activity';
import { unauthorized } from '../lib/errors';
import { computeStreak, getStats, levelForXp, STREAK_DAYS_MAX } from '../lib/stats';

type CheckinRow = typeof moodCheckins.$inferSelect;

const toCheckin = (row: CheckinRow): Checkin => ({
  id: row.id,
  mood: row.mood,
  note: row.note,
  source: row.source,
  createdAt: row.createdAt.toISOString(),
});

/** Check-ins, activities and GET /today (ticket 06). Inside the auth-guarded scope. */
export function registerTodayRoutes(
  scope: FastifyInstance,
  { db, clock, daily }: { db: Database; clock: Clock; daily: DailyService },
) {
  const app = scope.withTypeProvider<ZodTypeProvider>();

  async function loadUser(userId: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw unauthorized();
    return user;
  }

  app.post(
    '/checkins',
    { schema: { body: checkinRequestSchema, response: { 201: checkinResponseSchema } } },
    async (request, reply) => {
      const user = await loadUser(request.userId);
      const { mood, source } = request.body;
      const note = request.body.note ? request.body.note : null;
      const now = clock();
      const tz = user.timezone;

      const { checkin, activityId, updated, xp } = await db.transaction(async (tx) => {
        // XP only for the first few check-ins of the user's local day. The lock serialises one
        // user's concurrent check-ins so the count can't be raced past the limit.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`checkin-xp:${user.id}`}))`);
        const [awarded] = await tx
          .select({ n: count() })
          .from(activityLog)
          .where(
            and(
              eq(activityLog.userId, user.id),
              eq(activityLog.kind, 'checkin'),
              gt(activityLog.xpAwarded, 0),
              sql`(${activityLog.createdAt} at time zone ${tz})::date = (${now.toISOString()}::timestamptz at time zone ${tz})::date`,
            ),
          );
        const xp = (awarded?.n ?? 0) < CHECKIN_XP_DAILY_LIMIT ? ACTIVITY_XP.checkin : 0;
        const [row] = await tx
          .insert(moodCheckins)
          .values({ userId: user.id, mood, note, source, createdAt: now })
          .returning();
        if (!row) throw new Error('check-in insert returned no row');
        const logged = await logActivity(tx, {
          userId: user.id,
          kind: 'checkin',
          meta: { checkinId: row.id, mood, source },
          xp,
          at: now,
        });
        return { checkin: row, activityId: logged.activityId, updated: logged.user, xp };
      });

      // A note with crisis language never reaches a model: the helpline goes back instead.
      const crisis = note !== null && checkSafety(note).crisis;
      const suggestion: Suggestion = crisis
        ? CRISIS_SUGGESTION
        : await daily.checkinSuggestion(user, checkin, request.log);

      // Stored with the activity so GET /today shows the same sentence for the rest of the day.
      await db
        .update(activityLog)
        .set({ meta: sql`coalesce(${activityLog.meta}, '{}'::jsonb) || ${JSON.stringify({ suggestion })}::jsonb` })
        .where(eq(activityLog.id, activityId));

      // Make sure today's personal lines exist, so the next /today has them ready.
      daily.warm(user, mood, request.log);

      return reply.code(201).send({
        checkin: toCheckin(checkin),
        xpAwarded: xp,
        stats: await getStats(db, updated, now),
        suggestion,
        ...(crisis ? { crisis: { helpline: HELPLINE } } : {}),
      });
    },
  );

  app.get(
    '/checkins',
    { schema: { querystring: listCheckinsQuerySchema, response: { 200: listCheckinsResponseSchema } } },
    async (request) => {
      const user = await loadUser(request.userId);
      const { days } = request.query;
      const tz = user.timezone;
      const now = clock().toISOString();
      const rows = await db
        .select()
        .from(moodCheckins)
        .where(
          and(
            eq(moodCheckins.userId, user.id),
            // Local calendar days in the user's time zone, today included.
            sql`(${moodCheckins.createdAt} at time zone ${tz})::date > ((${now}::timestamptz at time zone ${tz})::date - ${days}::int)`,
          ),
        )
        .orderBy(desc(moodCheckins.createdAt), desc(moodCheckins.id))
        .limit(2000);
      return { items: rows.map(toCheckin) };
    },
  );

  app.post(
    '/activities',
    { schema: { body: activityRequestSchema, response: { 201: activityResponseSchema } } },
    async (request, reply) => {
      const user = await loadUser(request.userId);
      const { kind, meta } = request.body;
      const now = clock();
      const sessionId = typeof meta.sessionId === 'string' ? meta.sessionId : null;

      // XP needs a sessionId, and is awarded once per session. Without one the activity is still
      // logged (it counts for the streak) but earns nothing, so repeated calls can't farm XP.
      if (!sessionId) {
        const logged = await logActivity(db, { userId: user.id, kind, meta, xp: 0, at: now });
        return reply.code(201).send({ xpAwarded: 0, stats: await getStats(db, logged.user, now) });
      }

      const tz = user.timezone;
      const result = await db.transaction(async (tx) => {
        // One lock per user and kind serialises both checks below: a retried session can't be
        // awarded twice, and concurrent sessions can't race past the daily cap.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`activity-xp:${user.id}:${kind}`}))`);
        const [existing] = await tx
          .select({ id: activityLog.id })
          .from(activityLog)
          .where(
            and(
              eq(activityLog.userId, user.id),
              eq(activityLog.kind, kind),
              sql`${activityLog.meta}->>'sessionId' = ${sessionId}`,
            ),
          )
          .limit(1);
        if (existing) return { xpAwarded: 0, user };
        // The client picks sessionIds, so XP is also capped per local day: later sessions are
        // still logged (they count for the streak) but earn nothing.
        const [awarded] = await tx
          .select({ n: count() })
          .from(activityLog)
          .where(
            and(
              eq(activityLog.userId, user.id),
              eq(activityLog.kind, kind),
              gt(activityLog.xpAwarded, 0),
              sql`(${activityLog.createdAt} at time zone ${tz})::date = (${now.toISOString()}::timestamptz at time zone ${tz})::date`,
            ),
          );
        const xp = (awarded?.n ?? 0) < ACTIVITY_XP_DAILY_LIMIT[kind] ? ACTIVITY_XP[kind] : 0;
        const logged = await logActivity(tx, { userId: user.id, kind, meta, xp, at: now });
        return { xpAwarded: xp, user: logged.user };
      });

      return reply
        .code(201)
        .send({ xpAwarded: result.xpAwarded, stats: await getStats(db, result.user, now) });
    },
  );

  app.get('/today', { schema: { response: { 200: todayResponseSchema } } }, async (request) => {
    const now = clock().toISOString();
    // One round trip (Ddk, Nov 7): the user, their local "today", the last mood, today's latest
    // check-in suggestion, the active days for the streak and today's cached lines, all in one
    // statement. Every date is computed by Postgres in the user's own time zone.
    const rows = await db.execute<{
      name: string;
      goal: DailyUser['goal'];
      timezone: string;
      personalize: boolean;
      xp: number;
      today: string;
      last_mood: number | null;
      last_at: string | null;
      checkin_meta: { suggestion?: unknown } | null;
      days: string[];
      daily_text: string | null;
      daily_line: string | null;
      daily_suggestion: Suggestion | null;
    }>(sql`
      with u as (
        select ${users.id} as id, ${users.name} as name, ${users.goal} as goal, ${users.timezone} as timezone,
               ${users.personalize} as personalize, ${users.xp} as xp,
               ((${now}::timestamptz at time zone ${users.timezone})::date) as today
        from ${users} where ${users.id} = ${request.userId}
      )
      select u.name, u.goal, u.timezone, u.personalize, u.xp, u.today::text as today,
        (select ${moodCheckins.mood} from ${moodCheckins} where ${moodCheckins.userId} = u.id
          order by ${moodCheckins.createdAt} desc, ${moodCheckins.id} desc limit 1) as last_mood,
        (select to_char(${moodCheckins.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from ${moodCheckins}
          where ${moodCheckins.userId} = u.id order by ${moodCheckins.createdAt} desc, ${moodCheckins.id} desc limit 1) as last_at,
        (select ${activityLog.meta} from ${activityLog} where ${activityLog.userId} = u.id and ${activityLog.kind} = 'checkin'
          and (${activityLog.createdAt} at time zone u.timezone)::date = u.today
          order by ${activityLog.createdAt} desc, ${activityLog.id} desc limit 1) as checkin_meta,
        coalesce((select array_agg(d.day::text order by d.day desc) from (
          select distinct (${activityLog.createdAt} at time zone u.timezone)::date as day from ${activityLog}
          where ${activityLog.userId} = u.id order by day desc limit ${STREAK_DAYS_MAX + 1}) d), '{}') as days,
        da.text as daily_text, da.sola_line as daily_line, da.suggestion as daily_suggestion
      from u
      left join ${dailyAffirmations} da on da.user_id = u.id and da.date = u.today
    `);
    const row = rows[0];
    if (!row) throw unauthorized();

    const user: DailyUser = { id: request.userId, name: row.name, goal: row.goal, timezone: row.timezone, personalize: row.personalize };
    const lastMood = row.last_mood;
    // Never waits on the model: cached lines, or a handwritten line while the personal one is made.
    const lines = daily.fromRow(
      user,
      row.today,
      row.daily_text === null ? null : { text: row.daily_text, solaLine: row.daily_line, suggestion: row.daily_suggestion },
      lastMood,
      request.log,
    );
    // Today's latest check-in brought a fresher suggestion than the morning one.
    const fromCheckin = suggestionSchema.safeParse(row.checkin_meta?.suggestion);

    return {
      greeting: lines.greeting,
      affirmation: lines.affirmation,
      lastMood: lastMood !== null && row.last_at ? { mood: lastMood, createdAt: row.last_at } : null,
      suggestion: fromCheckin.success ? fromCheckin.data : lines.suggestion,
      stats: { xp: row.xp, ...levelForXp(row.xp), streak: computeStreak(row.days, row.today) },
    };
  });
}
