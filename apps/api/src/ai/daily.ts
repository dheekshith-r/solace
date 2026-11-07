/**
 * Today's AI lines (spec 5.3): Sola's daily line, the affirmation and a suggestion, generated
 * once per user per local day with Flash-Lite and cached in daily_affirmations; and the
 * suggestion after each mood check-in. Every path has a handwritten fallback.
 */
import { SUGGESTION_ACTIONS, type Goal, type Suggestion } from '@solace/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';
import type { Clock } from '../auth/tokens';
import type { Database } from '../db/client';
import { activityLog, dailyAffirmations, users } from '../db/schema';
import { localDate } from '../lib/stats';
import { type AiClient, toAiError } from './client';
import { loadHistory } from './context';
import { fallbackGreeting, fallbackSuggestion, FALLBACK_AFFIRMATIONS, pick } from './fallbacks';
import { withDeadline } from './guard';
import { inventsDetails, mentionsTimeOfDay } from './grounding';
import type { BackgroundTasks } from '../lib/background';
import {
  DAILY_SCHEMA,
  DAILY_SYSTEM,
  dailyPrompt,
  SUGGESTION_SCHEMA,
  SUGGESTION_SYSTEM,
  suggestionPrompt,
} from './prompts';

/** Flash-Lite answers in about 1.4 s; past this, Today uses its fallback rather than wait. */
export const DAILY_TIMEOUT_MS = 5_000;
export const SUGGESTION_TIMEOUT_MS = 4_000;
/** After a failed generation, the fallback is served for this long before trying again. */
export const DAILY_RETRY_AFTER_MS = 5 * 60_000;
/** Check-ins given to the daily prompt. */
const DAILY_MOODS = 7;
/** Earlier check-ins given to the check-in suggestion prompt. */
const SUGGESTION_MOODS = 3;

/** Cleans a model line: trims, drops wrapping quotes, rejects empty or overlong text. */
const line = (max: number) =>
  z
    .string()
    .transform((value) => value.trim().replace(/^["“']+|["”']+$/g, '').trim())
    .pipe(z.string().min(3).max(max));

const suggestionOutput = z.object({ text: line(220), action: z.enum(SUGGESTION_ACTIONS) });
const dailyOutput = z.object({
  greeting: line(220),
  affirmation: line(160),
  suggestion: suggestionOutput,
});

export type DailyLines = { greeting: string; affirmation: string; suggestion: Suggestion };

export type DailyUser = {
  id: string;
  name: string;
  goal: Goal | null;
  timezone: string;
  personalize: boolean;
};

export function createDailyService({
  db,
  ai,
  clock,
  tasks,
}: {
  db: Database;
  ai: AiClient;
  clock: Clock;
  /** Where background generation runs; drained when the app closes. */
  tasks?: BackgroundTasks;
}) {
  // Both maps are bounded: in-flight entries are removed when they settle, and retry entries
  // are pruned once expired (and capped).
  const inFlight = new Map<string, Promise<DailyLines>>();
  const retryAfter = new Map<string, number>();
  const RETRY_ENTRIES_MAX = 10_000;

  function fallback(user: DailyUser, date: string, lastMood: number | null): DailyLines {
    const key = `${user.id}:${date}`;
    return {
      greeting: fallbackGreeting({
        name: user.name,
        goal: user.goal,
        lastMood: user.personalize ? lastMood : null,
        key,
      }),
      affirmation: pick(FALLBACK_AFFIRMATIONS, key),
      // Neutral: the last mood may be from another day, and these lines would call it "today".
      suggestion: fallbackSuggestion(null, key),
    };
  }

  async function generate(
    user: DailyUser,
    date: string,
    log: FastifyBaseLogger,
  ): Promise<DailyLines | 'personalize_off' | null> {
    const now = clock();
    const history = await loadHistory(db, user, { moods: DAILY_MOODS });
    const prompt = dailyPrompt({ profile: user, history, now });
    try {
      const raw = await withDeadline(DAILY_TIMEOUT_MS, (signal) =>
        ai.json({
          model: 'lite',
          purpose: 'daily',
          system: DAILY_SYSTEM,
          prompt,
          schema: DAILY_SCHEMA,
          signal,
        }),
      );
      const parsed = dailyOutput.safeParse(raw);
      if (!parsed.success) {
        log.warn({ purpose: 'daily', kind: 'invalid_output' }, 'ai call failed');
        return null;
      }
      const lines = parsed.data;
      // Only what the user actually said or logged: any invented detail drops the whole set.
      if ([lines.greeting, lines.affirmation, lines.suggestion.text].some((text) => inventsDetails(text, prompt))) {
        log.warn({ purpose: 'daily', kind: 'invented_detail' }, 'ai call failed');
        return null;
      }
      // Cached for the whole day, so no "Good morning" that would still show at night.
      if ([lines.greeting, lines.affirmation, lines.suggestion.text].some(mentionsTimeOfDay)) {
        log.warn({ purpose: 'daily', kind: 'time_of_day' }, 'ai call failed');
        return null;
      }
      if (user.personalize) {
        // Personalize may have been turned off while the model was writing lines from history:
        // then those lines are dropped, never cached.
        const [current] = await db
          .select({ personalize: users.personalize })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);
        if (!current?.personalize) return 'personalize_off';
      }
      await db
        .insert(dailyAffirmations)
        .values({
          userId: user.id,
          date,
          text: lines.affirmation,
          solaLine: lines.greeting,
          suggestion: lines.suggestion,
        })
        .onConflictDoUpdate({
          target: [dailyAffirmations.userId, dailyAffirmations.date],
          set: { text: lines.affirmation, solaLine: lines.greeting, suggestion: lines.suggestion },
          // A row someone else completed first wins, so the day's line never changes.
          setWhere: isNull(dailyAffirmations.solaLine),
        });
      const [stored] = await db
        .select()
        .from(dailyAffirmations)
        .where(and(eq(dailyAffirmations.userId, user.id), eq(dailyAffirmations.date, date)))
        .limit(1);
      return stored?.solaLine
        ? { greeting: stored.solaLine, affirmation: stored.text, suggestion: stored.suggestion ?? lines.suggestion }
        : lines;
    } catch (error) {
      const failure = toAiError(error);
      log.warn({ purpose: 'daily', kind: failure.kind, status: failure.status }, 'ai call failed');
      return null;
    }
  }

  /**
   * The day's lines. Reads the cache; on a miss generates once (concurrent callers share the
   * call). On failure returns the fallback without caching it, and waits a few minutes before
   * calling the model again for that user.
   */
  async function load(
    user: DailyUser,
    date: string,
    lastMood: number | null,
    log: FastifyBaseLogger,
  ): Promise<DailyLines> {
    const [row] = await db
      .select()
      .from(dailyAffirmations)
      .where(and(eq(dailyAffirmations.userId, user.id), eq(dailyAffirmations.date, date)))
      .limit(1);
    if (row?.solaLine) {
      return {
        greeting: row.solaLine,
        affirmation: row.text,
        suggestion: row.suggestion ?? fallbackSuggestion(null, `${user.id}:${date}`),
      };
    }

    const key = `${user.id}:${date}`;
    const now = clock().getTime();
    const waitUntil = retryAfter.get(key);
    if (waitUntil !== undefined && waitUntil > now) return fallback(user, date, lastMood);

    const lines = await generate(user, date, log);
    // Not a failure: the next call generates afresh without history, so no wait is set.
    if (lines === 'personalize_off') return fallback({ ...user, personalize: false }, date, null);
    if (lines) {
      retryAfter.delete(key);
      return lines;
    }
    if (retryAfter.size >= RETRY_ENTRIES_MAX) {
      for (const [k, until] of retryAfter) if (until <= now) retryAfter.delete(k);
      if (retryAfter.size >= RETRY_ENTRIES_MAX) retryAfter.clear();
    }
    retryAfter.set(key, now + DAILY_RETRY_AFTER_MS);
    return fallback(user, date, lastMood);
  }

  /**
   * The day's lines. Reads the cache; on a miss generates once. Concurrent callers for the same
   * user and day share one read-and-generate. On failure returns the fallback without caching
   * it, and waits a few minutes before calling the model again for that user.
   */
  function get(user: DailyUser, lastMood: number | null, log: FastifyBaseLogger): Promise<DailyLines> {
    const date = localDate(clock(), user.timezone);
    const key = `${user.id}:${date}`;
    let pending = inFlight.get(key);
    if (!pending) {
      pending = load(user, date, lastMood, log).finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
    }
    return pending;
  }

  /**
   * The day's lines without waiting on the model (Ddk, Nov 7: the first /today must answer in under a
   * second). A cached line is returned at once; on a miss the handwritten line goes back now and the
   * personal one is generated in the background, ready for the next fetch.
   */
  async function peek(user: DailyUser, lastMood: number | null, log: FastifyBaseLogger): Promise<DailyLines> {
    const date = localDate(clock(), user.timezone);
    const [row] = await db
      .select()
      .from(dailyAffirmations)
      .where(and(eq(dailyAffirmations.userId, user.id), eq(dailyAffirmations.date, date)))
      .limit(1);
    if (row?.solaLine) {
      return { greeting: row.solaLine, affirmation: row.text, suggestion: row.suggestion ?? fallbackSuggestion(null, `${user.id}:${date}`) };
    }
    warm(user, lastMood, log);
    return fallback(user, date, lastMood);
  }

  /**
   * Like `peek`, for a caller that already read today's cached row in its own query (GET /today
   * does it in one round trip): no extra query here.
   */
  function fromRow(
    user: DailyUser,
    date: string,
    row: { text: string; solaLine: string | null; suggestion: Suggestion | null } | null,
    lastMood: number | null,
    log: FastifyBaseLogger,
  ): DailyLines {
    if (row?.solaLine) {
      return { greeting: row.solaLine, affirmation: row.text, suggestion: row.suggestion ?? fallbackSuggestion(null, `${user.id}:${date}`) };
    }
    warm(user, lastMood, log);
    return fallback(user, date, lastMood);
  }

  /** Generates today's lines in the background if they aren't cached yet. Shares any call in flight. */
  function warm(user: DailyUser, lastMood: number | null, log: FastifyBaseLogger): void {
    const run = async () => {
      await get(user, lastMood, log);
    };
    if (tasks) tasks.run('daily-lines', log, run);
    else void run().catch(() => undefined);
  }

  /** One-sentence suggestion right after a check-in. Never throws. */
  async function checkinSuggestion(
    user: DailyUser,
    checkin: { id: string; mood: number; note: string | null },
    log: FastifyBaseLogger,
  ): Promise<Suggestion> {
    const now = clock();
    try {
      // The check-in just saved goes in as "just logged", not as history.
      const earlier = await loadHistory(db, user, {
        moods: SUGGESTION_MOODS,
        excludeCheckinId: checkin.id,
      });
      const prompt = suggestionPrompt({ profile: user, history: earlier, now, mood: checkin.mood, note: checkin.note });
      const raw = await withDeadline(SUGGESTION_TIMEOUT_MS, (signal) =>
        ai.json({
          model: 'lite',
          purpose: 'suggestion',
          system: SUGGESTION_SYSTEM,
          prompt,
          schema: SUGGESTION_SCHEMA,
          signal,
        }),
      );
      const parsed = suggestionOutput.safeParse(raw);
      // Shown on Today for the rest of the day, so the same two rules as the daily lines.
      const kind = !parsed.success
        ? 'invalid_output'
        : inventsDetails(parsed.data.text, prompt)
          ? 'invented_detail'
          : mentionsTimeOfDay(parsed.data.text)
            ? 'time_of_day'
            : null;
      if (parsed.success && kind === null) return parsed.data;
      log.warn({ purpose: 'suggestion', kind }, 'ai call failed');
    } catch (error) {
      const failure = toAiError(error);
      log.warn({ purpose: 'suggestion', kind: failure.kind, status: failure.status }, 'ai call failed');
    }
    return fallbackSuggestion(checkin.mood, checkin.id);
  }

  /**
   * Personalize was turned off: drop today's cached lines and today's check-in suggestions,
   * which were written from personal history, so nothing personal lingers. The next /today
   * generates fresh lines without history.
   */
  async function forgetToday(user: { id: string; timezone: string }) {
    const now = clock();
    const date = localDate(now, user.timezone);
    const key = `${user.id}:${date}`;
    retryAfter.delete(key);
    await db
      .delete(dailyAffirmations)
      .where(and(eq(dailyAffirmations.userId, user.id), eq(dailyAffirmations.date, date)));
    await db
      .update(activityLog)
      .set({ meta: sql`${activityLog.meta} - 'suggestion'` })
      .where(
        and(
          eq(activityLog.userId, user.id),
          eq(activityLog.kind, 'checkin'),
          sql`(${activityLog.createdAt} at time zone ${user.timezone})::date = ${date}::date`,
        ),
      );
  }

  return { get, peek, fromRow, warm, checkinSuggestion, forgetToday };
}

export type DailyService = ReturnType<typeof createDailyService>;
