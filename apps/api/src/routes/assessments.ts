/**
 * POST /assessments: a Reflect result (ticket 10). Scores the four 0-3 answers, picks the band,
 * asks Flash-Lite for three moves (handwritten fallback per band), and logs the activity once.
 * Reflect has no free text, so the crisis pre-check does not apply here; if a note field is
 * ever added, it must go through checkSafety first (as check-in notes do).
 */
import {
  ACTIVITY_XP,
  ASSESSMENT_XP_DAILY_LIMIT,
  assessmentBand,
  assessmentRequestSchema,
  assessmentResponseSchema,
  MOVE_ACTIONS,
  type Move,
  needsSupport,
} from '@solace/shared';
import { and, count, eq, gt, sql } from 'drizzle-orm';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { type AiClient, toAiError } from '../ai/client';
import { loadHistory } from '../ai/context';
import { FALLBACK_MOVES } from '../ai/fallbacks';
import { withDeadline } from '../ai/guard';
import { MOVES_SCHEMA, MOVES_SYSTEM, movesPrompt } from '../ai/prompts';
import type { Clock } from '../auth/tokens';
import type { Database } from '../db/client';
import { activityLog, assessments, users } from '../db/schema';
import { logActivity } from '../lib/activity';
import { unauthorized } from '../lib/errors';

export const MOVES_TIMEOUT_MS = 5_000;
/** Check-ins given to the moves prompt (only with personalize on). */
const MOVES_MOODS = 5;

const movesOutput = z.object({
  moves: z
    .array(
      z.object({
        text: z
          .string()
          .transform((value) => value.trim().replace(/^["“']+|["”']+$/g, '').trim())
          .pipe(z.string().min(3).max(200)),
        action: z.enum(MOVE_ACTIONS),
      }),
    )
    .length(3),
});

export function registerAssessmentRoutes(
  scope: FastifyInstance,
  { db, ai, clock }: { db: Database; ai: AiClient; clock: Clock },
) {
  const app = scope.withTypeProvider<ZodTypeProvider>();

  async function writeMoves(
    input: Parameters<typeof movesPrompt>[0],
    log: FastifyBaseLogger,
  ): Promise<Move[]> {
    try {
      const raw = await withDeadline(MOVES_TIMEOUT_MS, (signal) =>
        ai.json({
          model: 'lite',
          purpose: 'moves',
          system: MOVES_SYSTEM,
          prompt: movesPrompt(input),
          schema: MOVES_SCHEMA,
          signal,
        }),
      );
      const parsed = movesOutput.safeParse(raw);
      if (parsed.success) return parsed.data.moves;
      log.warn({ purpose: 'moves', kind: 'invalid_output' }, 'ai call failed');
    } catch (error) {
      const failure = toAiError(error);
      log.warn({ purpose: 'moves', kind: failure.kind, status: failure.status }, 'ai call failed');
    }
    return [...FALLBACK_MOVES[input.band as keyof typeof FALLBACK_MOVES]];
  }

  app.post(
    '/assessments',
    { schema: { body: assessmentRequestSchema, response: { 201: assessmentResponseSchema } } },
    async (request, reply) => {
      const [user] = await db.select().from(users).where(eq(users.id, request.userId)).limit(1);
      if (!user) throw unauthorized();
      const { kind, answers } = request.body;
      const score = answers.reduce((sum, answer) => sum + answer, 0);
      const band = assessmentBand(score);
      const support = needsSupport(kind, answers, band);
      const now = clock();
      const tz = user.timezone;

      // History (moods, the previous Reflect result, the latest chat summary) only with
      // personalize on; loadHistory returns nothing otherwise.
      const history = await loadHistory(db, user, { moods: MOVES_MOODS });
      const moves = await writeMoves(
        { profile: user, history, now, kind, answers, score, band },
        request.log,
      );

      const saved = await db.transaction(async (tx) => {
        // Same daily cap pattern as check-ins and activities: one lock per user, then count.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`assessment-xp:${user.id}`}))`);
        const [awarded] = await tx
          .select({ n: count() })
          .from(activityLog)
          .where(
            and(
              eq(activityLog.userId, user.id),
              eq(activityLog.kind, 'assessment'),
              gt(activityLog.xpAwarded, 0),
              sql`(${activityLog.createdAt} at time zone ${tz})::date = (${now.toISOString()}::timestamptz at time zone ${tz})::date`,
            ),
          );
        const xp = (awarded?.n ?? 0) < ASSESSMENT_XP_DAILY_LIMIT ? ACTIVITY_XP.assessment : 0;
        const [row] = await tx
          .insert(assessments)
          .values({ userId: user.id, kind, answers, score, band, moves, createdAt: now })
          .returning();
        if (!row) throw new Error('assessment insert returned no row');
        await logActivity(tx, {
          userId: user.id,
          kind: 'assessment',
          meta: { assessmentId: row.id, kind, band },
          xp,
          at: now,
        });
        return row;
      });

      return reply.code(201).send({
        assessment: {
          id: saved.id,
          kind: saved.kind,
          score: saved.score,
          band: saved.band,
          createdAt: saved.createdAt.toISOString(),
        },
        moves,
        support,
      });
    },
  );
}
