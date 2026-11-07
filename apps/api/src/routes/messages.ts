/**
 * POST /conversations/:id/messages: Sola's streamed reply (spec 2.1).
 *
 * 1. Save the user message (before anything can fail, so it is never lost).
 * 2. Safety pre-check. On a hit: the fixed caring reply, a `crisis` event, and no model call.
 * 3. Context: system prompt, profile, and (only with personalize on) recent moods, the latest
 *    Reflect result and the conversation summary; plus the last 12 messages.
 * 4. Stream the reply model as `delta` events. A 429/5xx/timeout before the first delta is
 *    retried once on Flash-Lite; a second failure sends `error`.
 * 5. Save the reply, classify it with Flash-Lite, send `meta`, then `done`.
 * 6. Every 10 messages, refresh the summary in the background, after `done`.
 */
import {
  conversationIdParamsSchema,
  HELPLINE,
  sendMessageRequestSchema,
  SUGGESTED_ACTIONS,
  type SuggestedAction,
} from '@solace/shared';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  AiError,
  type AiClient,
  type ChatTurn,
  type ModelRole,
  PRIMARY_503_BACKOFF_MS,
  toAiError,
} from '../ai/client';
import { loadHistory } from '../ai/context';
import { guardStream, withDeadline } from '../ai/guard';
import {
  chatSystemPrompt,
  CLASSIFY_SCHEMA,
  CLASSIFY_SYSTEM,
  classifyPrompt,
  SUMMARY_SCHEMA,
  SUMMARY_SYSTEM,
  summaryPrompt,
} from '../ai/prompts';
import { checkSafety, type CrisisLanguage, crisisReply, guessLanguage } from '../ai/safety';
import type { RateLimit } from '../app';
import type { Database } from '../db/client';
import { conversations, messages, users } from '../db/schema';
import type { AiStats } from '../lib/ai-stats';
import type { BackgroundTasks } from '../lib/background';
import { ApiError, unauthorized } from '../lib/errors';
import { openSse, type SseStream } from '../lib/sse';
import { conversationNotFound, isUuid } from './conversations';

/** Messages of the conversation sent to the model with each reply (spec 2.1 step 4). */
export const CONTEXT_MESSAGES = 12;
/** Check-ins included in the chat context. */
const CONTEXT_MOODS = 3;
/** A summary is regenerated each time the message count passes a multiple of this. */
export const SUMMARY_EVERY = 10;
/** Messages given to the summary prompt, with the previous summary. */
const SUMMARY_MESSAGES = 20;
const SUMMARY_MAX_CHARS = 700;

export type ChatTimeouts = {
  /** Time to the first delta before falling back (the reply model can stall when overloaded). */
  firstDeltaMs: number;
  /** Longest gap between deltas once streaming. */
  idleMs: number;
  classifyMs: number;
  summaryMs: number;
  heartbeatMs: number;
  /** Waits before each retry of the primary after a 503 (see PRIMARY_503_BACKOFF_MS). */
  primary503BackoffMs: readonly number[];
};

export const DEFAULT_CHAT_TIMEOUTS: ChatTimeouts = {
  firstDeltaMs: 6_000,
  idleMs: 15_000,
  classifyMs: 4_000,
  summaryMs: 20_000,
  heartbeatMs: 15_000,
  primary503BackoffMs: PRIMARY_503_BACKOFF_MS,
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const classification = z.object({
  mood: z.number().int().min(1).max(5),
  suggested_action: z.enum(SUGGESTED_ACTIONS),
  title: z.string().optional(),
});

const summaryOutput = z.object({ summary: z.string().trim().min(1).max(SUMMARY_MAX_CHARS) });

/** A title the app can show: one line, a few words, no wrapping quotes. */
function cleanTitle(title: string | undefined): string | null {
  if (!title) return null;
  const cleaned = title
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["“'«]+|["”'»]+$/g, '')
    .replace(/[.!?。]+$/, '')
    .trim();
  if (cleaned.length === 0) return null;
  return cleaned.split(' ').slice(0, 6).join(' ').slice(0, 60);
}

/** Model turns from stored messages, oldest first, starting with the user, roles merged. */
export function toTurns(rows: { role: 'user' | 'assistant'; content: string }[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const row of rows) {
    const last = turns.at(-1);
    if (last && last.role === row.role) last.text = `${last.text}\n\n${row.content}`;
    else if (turns.length > 0 || row.role === 'user') turns.push({ role: row.role, text: row.content });
  }
  return turns;
}

const alreadyAnswered = () => ({
  code: 'already_answered',
  message: 'Sola already answered that message.',
});

const replyFailed = () => ({
  code: 'reply_failed',
  message: 'Sola couldn’t reply just now. Your message is saved, so try again in a moment.',
});

export function registerMessageRoutes(
  scope: FastifyInstance,
  {
    db,
    ai,
    tasks,
    aiStats,
    messageLimit,
    timeouts,
  }: {
    db: Database;
    ai: AiClient;
    tasks: BackgroundTasks;
    aiStats: AiStats;
    messageLimit: RateLimit;
    timeouts: ChatTimeouts;
  },
) {
  const app = scope.withTypeProvider<ZodTypeProvider>();

  type Executor = Pick<Database, 'execute'>;

  /**
   * Saves a message and bumps the conversation (count and last activity) in one statement.
   * With `onlyIfLatest`, the insert happens only while that message is still the conversation's
   * latest (a retry); otherwise it returns null. Both statements always run together.
   */
  async function insertMessage(
    values: {
      conversationId: string;
      role: 'user' | 'assistant';
      content: string;
      flaggedCrisis?: boolean;
      suggestedAction?: SuggestedAction;
    },
    { executor = db, onlyIfLatest }: { executor?: Executor; onlyIfLatest?: string } = {},
  ): Promise<{ id: string; count: number } | null> {
    const guard = onlyIfLatest
      ? sql`where (
          select m.id from messages m where m.conversation_id = ${values.conversationId}
          order by m.created_at desc, m.id desc limit 1
        ) = ${onlyIfLatest}`
      : sql``;
    // clock_timestamp(), not now(): two messages saved in quick succession must never tie.
    const rows = await executor.execute<{ id: string; message_count: number }>(sql`
      with inserted as (
        insert into messages (conversation_id, role, content, flagged_crisis, suggested_action, created_at)
        select ${values.conversationId}::uuid, ${values.role}::message_role, ${values.content},
          ${values.flaggedCrisis ?? false}, ${values.suggestedAction ?? null}::suggested_action,
          clock_timestamp()
        ${guard}
        returning id, conversation_id
      ), bumped as (
        update conversations
        set message_count = message_count + 1, last_message_at = clock_timestamp()
        where id = (select conversation_id from inserted)
        returning message_count
      )
      select inserted.id, bumped.message_count from inserted cross join bumped
    `);
    const row = rows[0];
    return row ? { id: row.id, count: Number(row.message_count) } : null;
  }

  /** insertMessage that must succeed. */
  async function saveMessage(values: Parameters<typeof insertMessage>[0]) {
    const saved = await insertMessage(values);
    if (!saved) throw new Error('message insert returned no row');
    return saved;
  }

  /**
   * Saves the reply to a retried message. Serialised per conversation with an advisory lock,
   * and guarded so it saves only while the retried message is still unanswered: two concurrent
   * retries can never both save a reply.
   */
  async function saveRetryReply(values: Parameters<typeof insertMessage>[0], retryOf: string) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${values.conversationId}))`);
      return insertMessage(values, { executor: tx, onlyIfLatest: retryOf });
    });
  }

  /**
   * Streams one model's reply into `sse`. Returns the full text, or throws AiError. `sent` tells
   * the caller whether any delta reached the client (then retrying would duplicate text).
   */
  async function streamFrom(
    model: ModelRole,
    request: { system: string; turns: ChatTurn[] },
    sse: SseStream,
    progress: { sent: boolean },
  ) {
    const controller = new AbortController();
    const onClientGone = () => controller.abort();
    sse.signal.addEventListener('abort', onClientGone, { once: true });
    let text = '';
    try {
      const source = ai.stream({
        model,
        purpose: 'reply',
        system: request.system,
        turns: request.turns,
        signal: controller.signal,
      });
      for await (const chunk of guardStream(source, {
        firstMs: timeouts.firstDeltaMs,
        idleMs: timeouts.idleMs,
        controller,
      })) {
        if (sse.closed) throw new AiError('aborted');
        text += chunk;
        progress.sent = true;
        sse.send('delta', { text: chunk });
      }
    } catch (error) {
      throw toAiError(error, controller.signal);
    } finally {
      sse.signal.removeEventListener('abort', onClientGone);
    }
    if (text.trim().length === 0) throw new AiError('invalid_output');
    return text;
  }

  async function classify(
    userText: string,
    replyText: string,
    wantTitle: boolean,
    log: FastifyBaseLogger,
  ) {
    try {
      const raw = await withDeadline(timeouts.classifyMs, (signal) =>
        ai.json({
          model: 'lite',
          purpose: 'classify',
          system: CLASSIFY_SYSTEM,
          prompt: classifyPrompt({ userText, replyText, wantTitle }),
          schema: CLASSIFY_SCHEMA,
          signal,
        }),
      );
      const parsed = classification.safeParse(raw);
      if (parsed.success) {
        return {
          mood: parsed.data.mood,
          suggestedAction: parsed.data.suggested_action,
          title: wantTitle ? cleanTitle(parsed.data.title) : null,
        };
      }
      log.warn({ purpose: 'classify', kind: 'invalid_output' }, 'ai call failed');
    } catch (error) {
      const failure = toAiError(error);
      log.warn({ purpose: 'classify', kind: failure.kind, status: failure.status }, 'ai call failed');
    }
    return { mood: null, suggestedAction: 'none' as const, title: null };
  }

  async function summarize(conversationId: string) {
    const [conversation] = await db
      .select({ summary: conversations.summary })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    if (!conversation) return;
    const recent = await db
      .select({ role: messages.role, content: messages.content, flagged: messages.flaggedCrisis })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(SUMMARY_MESSAGES);
    // Crisis messages are not kept in memory notes.
    const turns = recent
      .reverse()
      .filter((row) => !row.flagged)
      .map((row) => ({ role: row.role, text: row.content }));
    if (turns.length === 0) return;

    const raw = await withDeadline(timeouts.summaryMs, (signal) =>
      ai.json({
        model: 'lite',
        purpose: 'summary',
        system: SUMMARY_SYSTEM,
        prompt: summaryPrompt({ previous: conversation.summary, turns }),
        schema: SUMMARY_SCHEMA,
        signal,
      }),
    );
    const parsed = summaryOutput.safeParse(raw);
    if (!parsed.success) throw new AiError('invalid_output');
    await db
      .update(conversations)
      .set({ summary: parsed.data.summary })
      .where(eq(conversations.id, conversationId));
  }

  app.post(
    '/conversations/:id/messages',
    {
      schema: { params: conversationIdParamsSchema, body: sendMessageRequestSchema },
      config: { rateLimit: messageLimit },
    },
    async (request, reply) => {
      const log = request.log;
      const conversationId = request.params.id;
      if (!isUuid(conversationId)) throw conversationNotFound();
      // User and conversation in one round trip: no user row means the account is gone (401);
      // no conversation means a bad id or someone else's (404).
      const [found] = await db
        .select({ user: users, conversation: conversations })
        .from(users)
        .leftJoin(
          conversations,
          and(eq(conversations.id, conversationId), eq(conversations.userId, users.id)),
        )
        .where(eq(users.id, request.userId))
        .limit(1);
      if (!found) throw unauthorized();
      const { user, conversation } = found;
      if (!conversation) throw conversationNotFound();
      const countBefore = conversation.messageCount;
      const retryOf = request.body.retryOf;

      // 1. Save (or, for a retry, find) the user message before streaming starts.
      let userMessage: { id: string; content: string; flaggedCrisis: boolean };
      let count: number;
      if (retryOf) {
        const [latest] = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conversation.id))
          .orderBy(desc(messages.createdAt), desc(messages.id))
          .limit(1);
        if (!latest || latest.id !== retryOf || latest.role !== 'user') {
          throw new ApiError(409, 'nothing_to_retry', 'That message already has a reply.');
        }
        userMessage = latest;
        count = countBefore;
      } else {
        const flaggedCrisis = checkSafety(request.body.text).crisis;
        const saved = await saveMessage({
          conversationId: conversation.id,
          role: 'user',
          content: request.body.text,
          flaggedCrisis,
        });
        userMessage = { id: saved.id, content: request.body.text, flaggedCrisis };
        count = saved.count;
      }

      /** Saves the assistant reply; for a retry, only if no other retry answered first. */
      const saveReply = async (values: { content: string; suggestedAction?: SuggestedAction }) => {
        const row = { conversationId: conversation.id, role: 'assistant' as const, ...values };
        const saved = retryOf ? await saveRetryReply(row, retryOf) : await saveMessage(row);
        if (saved) count = saved.count;
        return saved;
      };

      /**
       * The fixed caring reply, the helpline card, and no model call. Normally `delta`, `crisis`,
       * `done`. With `replace` (a block after some text was streamed), `crisis` comes first with
       * `replace: true` so the app clears the partial text, then the reply as `delta`, then `done`.
       */
      const sendCrisis = async (language: CrisisLanguage, replace: boolean) => {
        const text = crisisReply(language);
        if (replace) sse.send('crisis', { helpline: HELPLINE, replace: true });
        sse.send('delta', { text });
        const saved = await saveReply({ content: text, suggestedAction: 'none' });
        if (!replace) sse.send('crisis', { helpline: HELPLINE });
        if (saved) sse.send('done', { messageId: saved.id });
        else sse.send('error', alreadyAnswered());
      };

      const sse = openSse(reply, { heartbeatMs: timeouts.heartbeatMs });
      try {
        // 2. Safety pre-check: the model is never called.
        const safety = checkSafety(userMessage.content);
        if (safety.crisis) {
          if (!userMessage.flaggedCrisis) {
            await db.update(messages).set({ flaggedCrisis: true }).where(eq(messages.id, userMessage.id));
          }
          await sendCrisis(safety.language, false);
          log.info({ crisis: true }, 'crisis pre-check hit');
          return;
        }

        // 3. Context. Flagged messages stay in the last 12 for continuity (Sola should know what
        // was just said), but any flag makes the conversation crisis-sensitive, which adds a
        // safe-mode note to the system prompt. Summaries leave flagged messages out (summarize).
        const [history, recent] = await Promise.all([
          loadHistory(db, user, { moods: CONTEXT_MOODS, conversationId: conversation.id }),
          db
            .select({ role: messages.role, content: messages.content, flagged: messages.flaggedCrisis })
            .from(messages)
            .where(eq(messages.conversationId, conversation.id))
            .orderBy(desc(messages.createdAt), desc(messages.id))
            .limit(CONTEXT_MESSAGES),
        ]);
        const turns = toTurns(recent.reverse());
        const system = chatSystemPrompt({
          profile: user,
          history,
          now: new Date(),
          crisisSensitive: recent.some((row) => row.flagged),
        });

        // 4. Stream, with one fallback to Flash-Lite. A safety block from the provider is
        // answered with the crisis reply, never an error.
        const progress = { sent: false };
        const onBlocked = async () => {
          await db.update(messages).set({ flaggedCrisis: true }).where(eq(messages.id, userMessage.id));
          // Same language heuristic as the pre-check, since no Hinglish pattern matched here.
          await sendCrisis(guessLanguage(userMessage.content), progress.sent);
          log.info({ crisis: true, blocked: true }, 'provider safety block');
        };
        // One line per reply, for measuring 503s: which model answered, how many 503s the
        // primary gave, and whether it fell back. Never any text.
        const outcome = { model: null as ModelRole | null, primary503s: 0, fellBack: false };
        const recordOutcome = () => {
          log.info({ event: 'reply_model', ...outcome }, 'reply_model');
          aiStats.record(outcome);
        };

        let primaryFailure: AiError | null = null;
        let answered: string | null = null;
        // Primary first. A 503 before any delta is retried after each backoff; anything else
        // (or the last 503) moves on to the fallback decision below.
        for (let attempt = 0; ; attempt += 1) {
          try {
            answered = await streamFrom('reply', { system, turns }, sse, progress);
            outcome.model = 'reply';
            break;
          } catch (error) {
            const failure = toAiError(error);
            log.warn({ purpose: 'reply', model: 'reply', kind: failure.kind, status: failure.status }, 'ai call failed');
            if (failure.status === 503) outcome.primary503s += 1;
            const backoff = timeouts.primary503BackoffMs[attempt];
            if (failure.status === 503 && backoff !== undefined && !progress.sent && !sse.closed) {
              await sleep(backoff);
              continue;
            }
            primaryFailure = failure;
            break;
          }
        }

        if (primaryFailure) {
          if (primaryFailure.kind === 'blocked' && !sse.closed) {
            recordOutcome();
            return await onBlocked();
          }
          if (sse.closed || progress.sent || !primaryFailure.retryable) {
            recordOutcome();
            sse.send('error', replyFailed());
            return;
          }
          outcome.fellBack = true;
          try {
            answered = await streamFrom('lite', { system, turns }, sse, progress);
            outcome.model = 'lite';
          } catch (fallbackError) {
            const second = toAiError(fallbackError);
            log.warn({ purpose: 'reply', model: 'lite', kind: second.kind, status: second.status }, 'ai call failed');
            recordOutcome();
            if (second.kind === 'blocked' && !sse.closed) return await onBlocked();
            sse.send('error', replyFailed());
            return;
          }
        }
        recordOutcome();
        if (answered === null) throw new Error('reply loop ended without an answer');
        const text = answered;

        // 5. Save the reply first, then classify it.
        const saved = await saveReply({ content: text });
        if (!saved) {
          sse.send('error', alreadyAnswered());
          return;
        }
        const meta = await classify(userMessage.content, text, conversation.title === null, log);
        try {
          await db
            .update(messages)
            .set({ mood: meta.mood, suggestedAction: meta.suggestedAction })
            .where(eq(messages.id, saved.id));
          if (meta.title) {
            await db
              .update(conversations)
              .set({ title: meta.title })
              .where(and(eq(conversations.id, conversation.id), isNull(conversations.title)));
          }
        } catch (error) {
          // The reply is already saved; losing its labels must not fail the stream.
          const cause = (error as { cause?: { code?: unknown } }).cause;
          log.warn(
            { errName: error instanceof Error ? error.name : 'unknown', causeCode: cause?.code },
            'saving reply labels failed',
          );
        }
        sse.send('meta', meta);
        sse.send('done', { messageId: saved.id });
      } catch (error) {
        log.error({ errName: error instanceof Error ? error.name : 'unknown' }, 'message stream failed');
        sse.send('error', replyFailed());
      } finally {
        sse.end();
        // 6. Background summary, after the stream has closed. Memory only with personalize on.
        if (user.personalize && Math.floor(countBefore / SUMMARY_EVERY) < Math.floor(count / SUMMARY_EVERY)) {
          tasks.run('summary', log, () => summarize(conversation.id));
        }
      }
    },
  );
}
