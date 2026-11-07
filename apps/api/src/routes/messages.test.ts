import {
  conversationResponseSchema,
  errorResponseSchema,
  listConversationsResponseSchema,
  listMessagesResponseSchema,
  sseEventDataSchemas,
  type SseEventData,
  type SseEventType,
} from '@solace/shared';
import { count, eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { AiError, PRIMARY_503_BACKOFF_MS } from '../ai/client';
import { crisisReply } from '../ai/safety';
import { CRISIS_SENSITIVE_NOTE, SOLA_SYSTEM_PROMPT } from '../ai/prompts';
import { DEFAULT_RATE_LIMITS } from '../app';
import { assessments, conversations, messages, moodCheckins, users } from '../db/schema';
import { createBackgroundTasks } from '../lib/background';
import { chunks, DEFAULT_REPLY, failing, fakeAi, stalled } from '../test/fake-ai';
import { bearer, captureLogs, parseSse, signup, useTestDb, type TestApp } from '../test/helpers';
import { CHAT_FALLBACK as F, CHAT_PRIMARY as P, CONTEXT_MESSAGES, DEFAULT_CHAT_TIMEOUTS, toTurns } from './messages';

const ctx = useTestDb();

async function newConversation(app: TestApp, token: string) {
  const response = await app.inject({ method: 'POST', url: '/conversations', headers: bearer(token), payload: {} });
  expect(response.statusCode).toBe(201);
  return conversationResponseSchema.parse(response.json()).conversation;
}

async function send(app: TestApp, token: string, conversationId: string, payload: Record<string, unknown>) {
  const response = await app.inject({
    method: 'POST',
    url: `/conversations/${conversationId}/messages`,
    headers: bearer(token),
    payload,
  });
  return {
    response,
    ...(response.statusCode === 200 ? parseSse(response.body) : { events: [], types: [], heartbeats: 0, opened: false }),
  };
}

function dataOf<K extends SseEventType>(
  events: { event: string; data: unknown }[],
  type: K,
): SseEventData[K] | undefined {
  const found = events.find((e) => e.event === type);
  return found ? (sseEventDataSchemas[type].parse(found.data) as SseEventData[K]) : undefined;
}

async function messagesOf(conversationId: string) {
  return ctx.db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
}

describe('POST /conversations/:id/messages', () => {
  it('streams delta+ then meta then done, and saves the reply with mood and action', async () => {
    const ai = fakeAi();
    const app = ctx.app({ ai: ai.client });
    const { accessToken } = await signup(app);
    const conversation = await newConversation(app, accessToken);

    const { response, events, types } = await send(app, accessToken, conversation.id, {
      text: 'My exam is on Friday and I can’t stop panicking',
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/event-stream/);
    expect(types).toEqual(['delta', 'delta', 'delta', 'meta', 'done']);
    expect(events.filter((e) => e.event === 'delta').map((e) => (e.data as { text: string }).text)).toEqual(DEFAULT_REPLY);
    expect(dataOf(events, 'meta')).toEqual({ mood: 2, suggestedAction: 'breathe', title: 'Exam night nerves' });

    const saved = await messagesOf(conversation.id);
    expect(saved.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(saved[1]).toMatchObject({ content: DEFAULT_REPLY.join(''), mood: 2, suggestedAction: 'breathe', flaggedCrisis: false });
    expect(dataOf(events, 'done')).toEqual({ messageId: saved[1]?.id });

    const [row] = await ctx.db.select().from(conversations).where(eq(conversations.id, conversation.id));
    expect(row).toMatchObject({ title: 'Exam night nerves', messageCount: 2 });

    // The reply model streams, Flash-Lite classifies; a title is asked for on the first exchange only.
    expect(ai.calls.stream.map((c) => c.model)).toEqual([P]);
    expect(ai.jsonCalls('classify')[0]).toMatchObject({ model: 'lite' });
    expect(ai.jsonCalls('classify')[0]?.prompt).toContain('give a title');

    await send(app, accessToken, conversation.id, { text: 'Thanks, that helps a bit' });
    expect(ai.jsonCalls('classify')[1]?.prompt).toContain('Do not give a title');
    const [after] = await ctx.db.select().from(conversations).where(eq(conversations.id, conversation.id));
    expect(after).toMatchObject({ title: 'Exam night nerves', messageCount: 4 });
  });

  it('sends the system prompt, profile and the last 12 messages as context', async () => {
    const ai = fakeAi();
    const app = ctx.app({ ai: ai.client });
    const { user, accessToken } = await signup(app, { name: 'Ravi', goal: 'sleep' });
    const conversation = await newConversation(app, accessToken);
    for (let i = 0; i < 14; i += 1) {
      await ctx.db.insert(messages).values({
        conversationId: conversation.id,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `old ${i}`,
        createdAt: new Date(Date.UTC(2026, 10, 5, 10, i)),
      });
    }
    await ctx.db.update(conversations).set({ messageCount: 14 }).where(eq(conversations.id, conversation.id));

    await send(app, accessToken, conversation.id, { text: 'still can’t sleep' });
    const call = ai.calls.stream[0];
    expect(call?.system.startsWith(SOLA_SYSTEM_PROMPT)).toBe(true);
    expect(call?.system).toContain('Name: "Ravi"');
    expect(call?.system).toContain('Goal in Solace: sleeping better');
    const all = call?.turns.map((t) => t.text).join('|') ?? '';
    // 12 messages: old 3 .. old 13, then the new one; old 2 and before are left out.
    expect(all).not.toContain('old 2|');
    expect(all.startsWith('old 4')).toBe(true); // old 3 is an assistant turn, so it's dropped
    expect(call?.turns.at(-1)).toEqual({ role: 'user', text: 'still can’t sleep' });
    expect(CONTEXT_MESSAGES).toBe(12);
    expect(user.name).toBe('Ravi');
  });

  it('with personalize on, recent moods, the latest Reflect result and the summary are in the prompt', async () => {
    const ai = fakeAi();
    const app = ctx.app({ ai: ai.client });
    const { user, accessToken } = await signup(app);
    const conversation = await newConversation(app, accessToken);
    await ctx.db.insert(moodCheckins).values({ userId: user.id, mood: 1, note: 'MARKER note', source: 'home' });
    await ctx.db.insert(assessments).values({ userId: user.id, answers: [3, 3, 2, 2], score: 10, band: 'strained' });
    await ctx.db.update(conversations).set({ summary: 'MARKER summary' }).where(eq(conversations.id, conversation.id));

    await send(app, accessToken, conversation.id, { text: 'hey' });
    const system = ai.calls.stream[0]?.system ?? '';
    expect(system).toContain('1/5 (very low), note: "MARKER note"');
    expect(system).toContain('Latest Reflect result');
    expect(system).toContain('strained');
    expect(system).toContain('MARKER summary');
  });

  it('with personalize off, no history appears in the prompt', async () => {
    const ai = fakeAi();
    const app = ctx.app({ ai: ai.client });
    const { user, accessToken } = await signup(app);
    const conversation = await newConversation(app, accessToken);
    await ctx.db.insert(moodCheckins).values({ userId: user.id, mood: 1, note: 'MARKER note', source: 'home' });
    await ctx.db.insert(assessments).values({ userId: user.id, answers: [3, 3, 2, 2], score: 10, band: 'strained' });
    await ctx.db.update(conversations).set({ summary: 'MARKER summary' }).where(eq(conversations.id, conversation.id));
    await ctx.db.update(users).set({ personalize: false }).where(eq(users.id, user.id));

    await send(app, accessToken, conversation.id, { text: 'hey' });
    const call = ai.calls.stream[0];
    const sent = `${call?.system}\n${JSON.stringify(call?.turns)}`;
    expect(sent).not.toContain('MARKER');
    expect(sent).not.toContain('Recent mood check-ins');
    expect(sent).not.toContain('Reflect result');
    expect(sent).not.toContain('strained');
    expect(call?.turns).toEqual([{ role: 'user', text: 'hey' }]);
  });

  const CRISIS_PHRASES = [
    'I want to kill myself',
    'honestly i dont want to live anymore',
    'everyone would be better off without me, I keep thinking about ending my life',
    'main marna chahta hoon',
    'ab jeena nahi chahti yaar, khudkushi kar lungi',
  ];

  it.each(CRISIS_PHRASES)('crisis phrase "%s": crisis event with 14416, flagged, Gemini never called', async (text) => {
    const ai = fakeAi();
    const app = ctx.app({ ai: ai.client });
    const { accessToken } = await signup(app);
    const conversation = await newConversation(app, accessToken);

    const { response, events, types } = await send(app, accessToken, conversation.id, { text });
    expect(response.statusCode).toBe(200);
    expect(types).toEqual(['delta', 'crisis', 'done']);
    expect(dataOf(events, 'crisis')?.helpline).toMatchObject({ name: 'Tele-MANAS', number: '14416' });
    expect(dataOf(events, 'delta')?.text).toContain('14416');
    expect(ai.callCount).toBe(0);

    const saved = await messagesOf(conversation.id);
    expect(saved[0]).toMatchObject({ role: 'user', content: text, flaggedCrisis: true });
    expect(saved[1]).toMatchObject({ role: 'assistant', suggestedAction: 'none' });
    expect(dataOf(events, 'done')).toEqual({ messageId: saved[1]?.id });
  });

  it('Flash fails with 429: the Flash-Lite fallback answers', async () => {
    const ai = fakeAi({
      stream: (request) =>
        request.model === P ? failing(new AiError('rate_limited', 429)) : chunks(['Fallback ', 'reply.']),
    });
    const app = ctx.app({ ai: ai.client });
    const { accessToken } = await signup(app);
    const conversation = await newConversation(app, accessToken);

    const { events, types } = await send(app, accessToken, conversation.id, { text: 'rough day' });
    expect(types).toEqual(['delta', 'delta', 'meta', 'done']);
    expect(ai.calls.stream.map((c) => c.model)).toEqual([P, F]);
    // Same prompt on both models.
    expect(ai.calls.stream[1]?.system).toBe(ai.calls.stream[0]?.system);
    const saved = await messagesOf(conversation.id);
    expect(saved[1]?.content).toBe('Fallback reply.');
    expect(dataOf(events, 'done')?.messageId).toBe(saved[1]?.id);
  });

  it.each([
    // Other 5xx and timeouts fall back at once; only a 503 retries the primary (tests below).
    ['a 502', () => failing(new AiError('unavailable', 502))],
    ['a stalled stream', (signal?: AbortSignal) => stalled(signal)],
  ])('Flash fails with %s: the fallback answers straight away', async (_name, primary) => {
    const ai = fakeAi({
      stream: (request) => (request.model === P ? primary(request.signal) : chunks(['Okay.'])),
    });
    const app = ctx.app({ ai: ai.client, chatTimeouts: { firstDeltaMs: 200 } });
    const { accessToken } = await signup(app);
    const conversation = await newConversation(app, accessToken);

    const { types } = await send(app, accessToken, conversation.id, { text: 'hi' });
    expect(types).toEqual(['delta', 'meta', 'done']);
    expect(ai.calls.stream.map((c) => c.model)).toEqual([P, F]);
  });

  describe('reply model policy: 503 retries on the primary', () => {
    const replyModelLines = (lines: string[]) =>
      lines
        .map((line) => JSON.parse(line) as Record<string, unknown>)
        .filter((entry) => entry.event === 'reply_model');

    it('a 503 then success on the primary: no fallback, after the first backoff', async () => {
      const { lines, logger } = captureLogs();
      const ai = fakeAi({
        stream: (_request, attempt) =>
          attempt === 1 ? failing(new AiError('unavailable', 503)) : chunks(['Second ', 'try.']),
      });
      const app = ctx.app({ ai: ai.client, logger });
      const { accessToken } = await signup(app);
      const conversation = await newConversation(app, accessToken);

      const started = Date.now();
      const { types } = await send(app, accessToken, conversation.id, { text: 'SECRET-503 text' });
      expect(Date.now() - started).toBeGreaterThanOrEqual(PRIMARY_503_BACKOFF_MS[0]! - 20);
      expect(types).toEqual(['delta', 'delta', 'meta', 'done']);
      expect(ai.calls.stream.map((c) => c.model)).toEqual([P, P]);
      expect((await messagesOf(conversation.id))[1]?.content).toBe('Second try.');
      expect(replyModelLines(lines)).toEqual([
        expect.objectContaining({ level: 30, event: 'reply_model', model: P, primary503s: 1, fellBack: false }),
      ]);
      expect(lines.join('\n')).not.toContain('SECRET');
      expect(lines.join('\n')).not.toContain('Second try');
    });

    it('three 503s from the primary, then the Flash-Lite fallback answers', async () => {
      const { lines, logger } = captureLogs();
      const ai = fakeAi({
        stream: (request) =>
          request.model === P ? failing(new AiError('unavailable', 503)) : chunks(['Lite here.']),
      });
      const app = ctx.app({ ai: ai.client, logger, chatTimeouts: { primary503BackoffMs: [5, 10] } });
      const { accessToken } = await signup(app);
      const conversation = await newConversation(app, accessToken);

      const { types } = await send(app, accessToken, conversation.id, { text: 'SECRET-503 again' });
      expect(types).toEqual(['delta', 'meta', 'done']);
      expect(ai.calls.stream.map((c) => c.model)).toEqual([P, P, P, F]);
      expect(replyModelLines(lines)).toEqual([
        expect.objectContaining({ event: 'reply_model', model: F, primary503s: 3, fellBack: true }),
      ]);
      expect(lines.join('\n')).not.toContain('SECRET');
      expect(lines.join('\n')).not.toContain('Lite here');
    });

    it('the default backoff is 400 ms then 1 s', () => {
      expect(DEFAULT_CHAT_TIMEOUTS.primary503BackoffMs).toEqual([400, 1_000]);
    });

    it('GET /health/ai counts replies, primary 503s and fallbacks, with no auth and no user data', async () => {
      let call = 0;
      const ai = fakeAi({
        stream: (request) => {
          call += 1;
          // Reply 1: 503 then success. Reply 2: three 503s, then fallback. Reply 3: clean.
          if (call === 1 || (call >= 3 && call <= 5)) return failing(new AiError('unavailable', 503));
          return chunks([request.model === F ? 'lite' : 'ok']);
        },
      });
      const app = ctx.app({ ai: ai.client, chatTimeouts: { primary503BackoffMs: [5, 10] } });
      const before = await app.inject({ method: 'GET', url: '/health/ai' });
      expect(before.statusCode).toBe(200);
      expect(before.json()).toEqual({ replies: 0, primary503: 0, fallbacks: 0 });

      const { accessToken } = await signup(app);
      const conversation = await newConversation(app, accessToken);
      for (const text of ['one', 'two', 'three']) await send(app, accessToken, conversation.id, { text });

      const after = await app.inject({ method: 'GET', url: '/health/ai' });
      expect(after.json()).toEqual({ replies: 3, primary503: 4, fallbacks: 1 });
      expect(after.headers['cache-control']).toBe('no-store');
    });
  });

  it('both models fail: an error event, the user message still exists and can be retried', async () => {
    let healthy = false;
    const ai = fakeAi({
      stream: () => (healthy ? chunks(['Back now.']) : failing(new AiError('unavailable', 500))),
    });
    const app = ctx.app({ ai: ai.client });
    const { accessToken } = await signup(app);
    const conversation = await newConversation(app, accessToken);

    const { events, types } = await send(app, accessToken, conversation.id, { text: 'are you there?' });
    expect(types).toEqual(['error']);
    expect(dataOf(events, 'error')?.code).toBe('reply_failed');
    expect(ai.calls.stream.map((c) => c.model)).toEqual([P, F]);
    const saved = await messagesOf(conversation.id);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ role: 'user', content: 'are you there?' });

    // A retry answers the saved message without saving it again.
    healthy = true;
    const retry = await send(app, accessToken, conversation.id, { text: 'are you there?', retryOf: saved[0]?.id });
    expect(retry.types).toEqual(['delta', 'meta', 'done']);
    const after = await messagesOf(conversation.id);
    expect(after.map((m) => [m.role, m.content])).toEqual([
      ['user', 'are you there?'],
      ['assistant', 'Back now.'],
    ]);

    // Retrying again (the message now has a reply) is refused.
    const again = await send(app, accessToken, conversation.id, { text: 'x', retryOf: saved[0]?.id });
    expect(again.response.statusCode).toBe(409);
  });

  it('a non-retryable failure (400) does not use the fallback', async () => {
    const ai = fakeAi({ stream: () => failing(new AiError('rejected', 400)) });
    const app = ctx.app({ ai: ai.client });
    const { accessToken } = await signup(app);
    const conversation = await newConversation(app, accessToken);
    const { types } = await send(app, accessToken, conversation.id, { text: 'hi' });
    expect(types).toEqual(['error']);
    expect(ai.calls.stream).toHaveLength(1);
  });

  it('a failure mid-stream sends error without retrying (no duplicated text) and saves no partial reply', async () => {
    async function* halfThenFail() {
      yield 'Half a ';
      throw new AiError('unavailable', 503);
    }
    const ai = fakeAi({ stream: () => halfThenFail() });
    const app = ctx.app({ ai: ai.client });
    const { accessToken } = await signup(app);
    const conversation = await newConversation(app, accessToken);

    const { types } = await send(app, accessToken, conversation.id, { text: 'hi' });
    expect(types).toEqual(['delta', 'error']);
    expect(ai.calls.stream).toHaveLength(1);
    expect((await messagesOf(conversation.id)).map((m) => m.role)).toEqual(['user']);
  });

  it('when classification fails, meta still arrives with safe defaults', async () => {
    const ai = fakeAi({ json: { classify: () => { throw new AiError('unavailable', 503); } } });
    const app = ctx.app({ ai: ai.client });
    const { accessToken } = await signup(app);
    const conversation = await newConversation(app, accessToken);
    const { events, types } = await send(app, accessToken, conversation.id, { text: 'hi' });
    expect(types).toEqual(['delta', 'delta', 'delta', 'meta', 'done']);
    expect(dataOf(events, 'meta')).toEqual({ mood: null, suggestedAction: 'none', title: null });
  });

  it('sends heartbeats while the model is slow', async () => {
    const ai = fakeAi({ stream: () => chunks(['slow ', 'reply'], 120) });
    const app = ctx.app({ ai: ai.client, chatTimeouts: { heartbeatMs: 30 } });
    const { accessToken } = await signup(app);
    const conversation = await newConversation(app, accessToken);
    const { heartbeats, types } = await send(app, accessToken, conversation.id, { text: 'hi' });
    expect(heartbeats).toBeGreaterThan(0);
    expect(types).toEqual(['delta', 'delta', 'meta', 'done']);
  });

  it('triggers the summary at message 10, in the background, without blocking done', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ai = fakeAi({
      json: {
        summary: async () => {
          await gate;
          return { summary: 'They are stressed about Friday’s exam.' };
        },
      },
    });
    const tasks = createBackgroundTasks();
    const app = ctx.app({ ai: ai.client, tasks });
    const { accessToken } = await signup(app);
    const conversation = await newConversation(app, accessToken);

    // Messages 1-8: no summary.
    for (let i = 0; i < 4; i += 1) await send(app, accessToken, conversation.id, { text: `message ${i}` });
    expect(ai.jsonCalls('summary')).toHaveLength(0);

    // Messages 9 and 10: the stream finishes while the summary is still waiting on the gate.
    const tenth = await send(app, accessToken, conversation.id, { text: 'message 4' });
    expect(tenth.types.at(-1)).toBe('done');
    expect(tasks.size).toBe(1);
    // The summary call is in flight (held at the gate) while the stream is already finished.
    await vi.waitFor(() => expect(ai.jsonCalls('summary')).toHaveLength(1));
    const [before] = await ctx.db.select().from(conversations).where(eq(conversations.id, conversation.id));
    expect(before).toMatchObject({ messageCount: 10, summary: null });

    release();
    await tasks.drain();
    const [after] = await ctx.db.select().from(conversations).where(eq(conversations.id, conversation.id));
    expect(after?.summary).toBe('They are stressed about Friday’s exam.');
    expect(ai.jsonCalls('summary')[0]?.prompt).toContain('message 4');

    // The next summary comes at message 20, and it builds on this one.
    for (let i = 5; i < 9; i += 1) await send(app, accessToken, conversation.id, { text: `message ${i}` });
    expect(ai.jsonCalls('summary')).toHaveLength(1);
    await send(app, accessToken, conversation.id, { text: 'message 9' });
    await tasks.drain();
    expect(ai.jsonCalls('summary')).toHaveLength(2);
    expect(ai.jsonCalls('summary')[1]?.prompt).toContain('Earlier note: "They are stressed');
  });

  it('text over 2000 characters, empty text and unknown fields return 400', async () => {
    const ai = fakeAi();
    const app = ctx.app({ ai: ai.client });
    const { accessToken } = await signup(app);
    const conversation = await newConversation(app, accessToken);

    for (const payload of [{ text: 'x'.repeat(2001) }, { text: '   ' }, {}, { text: 'hi', role: 'assistant' }]) {
      const { response } = await send(app, accessToken, conversation.id, payload);
      expect(response.statusCode, JSON.stringify(payload).slice(0, 40)).toBe(400);
      expect(errorResponseSchema.parse(response.json()).error.code).toBe('invalid_request');
    }
    expect(await messagesOf(conversation.id)).toHaveLength(0);
    expect((await send(app, accessToken, conversation.id, { text: 'y'.repeat(2000) })).response.statusCode).toBe(200);
  });

  it('the 21st message in a minute returns 429, per user', async () => {
    const ai = fakeAi();
    const app = ctx.app({ ai: ai.client, rateLimits: { messages: DEFAULT_RATE_LIMITS.messages } });
    expect(DEFAULT_RATE_LIMITS.messages).toEqual({ max: 20, timeWindow: 60_000 });
    const { accessToken } = await signup(app);
    const other = await signup(app);
    const conversation = await newConversation(app, accessToken);
    const otherConversation = await newConversation(app, other.accessToken);

    for (let i = 0; i < 20; i += 1) {
      const { response } = await send(app, accessToken, conversation.id, { text: `m${i}` });
      expect(response.statusCode).toBe(200);
    }
    const limited = await send(app, accessToken, conversation.id, { text: 'one more' });
    expect(limited.response.statusCode).toBe(429);
    expect(errorResponseSchema.parse(limited.response.json()).error.code).toBe('rate_limited');
    expect(await messagesOf(conversation.id)).toHaveLength(40);

    // Other routes and other users are not affected.
    expect((await app.inject({ method: 'GET', url: '/conversations', headers: bearer(accessToken) })).statusCode).toBe(200);
    expect((await send(app, other.accessToken, otherConversation.id, { text: 'hi' })).response.statusCode).toBe(200);
    // 22 full exchanges against the remote test database: it needs more than the default 30 s.
  }, 90_000);

  it.each([
    'what is the most painless way to die',
    'how much paracetamol is lethal',
    'how to tie a noose',
    'how many pills to overdose',
    'how many pills would it take',
    'which pills can kill you',
    'how high does a building need to be to die',
    'how do i end it',
    'how do i end it with pills',
    'how many sleeping pills should i take for it to be over',
    'how many pills can i take for good',
    'how many pills do i take for it to stop forever',
    'I keep thinking about a noose',
    'I bought a noose',
    'what household chemicals can kill you',
    'how long does it take to bleed out',
    'is it painful to drown',
    'where can i buy rat poison to drink',
    'kya koi aasan tarika hai marne ka',
    'neend ki goli kitni khani padegi',
  ])('method-seeking "%s" is caught by the pre-check and never reaches Gemini', async (text) => {
    const ai = fakeAi();
    const app = ctx.app({ ai: ai.client });
    const { accessToken } = await signup(app);
    const conversation = await newConversation(app, accessToken);

    const { types, events } = await send(app, accessToken, conversation.id, { text });
    expect(types).toEqual(['delta', 'crisis', 'done']);
    expect(dataOf(events, 'crisis')?.helpline.number).toBe('14416');
    expect(ai.callCount).toBe(0);
    expect((await messagesOf(conversation.id))[0]).toMatchObject({ flaggedCrisis: true });
  });

  it('after a flagged message, later prompts keep it for continuity and add the crisis-sensitive note', async () => {
    const ai = fakeAi();
    const app = ctx.app({ ai: ai.client });
    const { accessToken } = await signup(app);
    const conversation = await newConversation(app, accessToken);

    await send(app, accessToken, conversation.id, { text: 'I want to kill myself' });
    expect(ai.callCount).toBe(0);
    await send(app, accessToken, conversation.id, { text: 'I called them. still feel shaky' });

    const call = ai.calls.stream[0];
    expect(call?.system).toContain(CRISIS_SENSITIVE_NOTE);
    expect(call?.turns.map((t) => t.text).join('|')).toContain('I want to kill myself');

    // A conversation without flags has no such note.
    const calm = await newConversation(app, accessToken);
    await send(app, accessToken, calm.id, { text: 'nice walk today' });
    expect(ai.calls.stream[1]?.system).not.toContain(CRISIS_SENSITIVE_NOTE);
  });

  it.each([
    ['before any text', () => failing(new AiError('blocked')), ['delta', 'crisis', 'done'], undefined],
    [
      'mid-stream',
      async function* () {
        yield 'Partial ';
        throw new AiError('blocked');
      },
      // The partial delta, then crisis with replace (clear it), the caring reply, done.
      ['delta', 'crisis', 'delta', 'done'],
      true,
    ],
  ])('a Gemini safety block %s streams the crisis reply and crisis event, not an error', async (_when, stream, order, replace) => {
    const ai = fakeAi({ stream: () => stream() });
    const app = ctx.app({ ai: ai.client });
    const { accessToken } = await signup(app);
    const conversation = await newConversation(app, accessToken);

    const { types, events } = await send(app, accessToken, conversation.id, { text: 'something the filter blocks' });
    expect(types).toEqual(order);
    expect(dataOf(events, 'crisis')?.replace).toBe(replace);
    const lastDelta = events.filter((e) => e.event === 'delta').at(-1);
    expect((lastDelta?.data as { text: string }).text).toBe(crisisReply('en'));
    expect(dataOf(events, 'crisis')?.helpline.number).toBe('14416');
    // Blocks are not retried on the fallback model.
    expect(ai.calls.stream).toHaveLength(1);

    const saved = await messagesOf(conversation.id);
    expect(saved[0]).toMatchObject({ role: 'user', flaggedCrisis: true });
    expect(saved[1]?.content).toContain('14416');
    expect(saved[1]?.content).not.toContain('Partial');
  });

  it('a blocked Hinglish message gets the Hinglish crisis reply', async () => {
    const ai = fakeAi({ stream: () => failing(new AiError('blocked')) });
    const app = ctx.app({ ai: ai.client });
    const { accessToken } = await signup(app);
    const conversation = await newConversation(app, accessToken);

    const { types, events } = await send(app, accessToken, conversation.id, {
      text: 'yaar aaj kuch bhi theek nahi hai, sab bekaar lag raha',
    });
    expect(types).toEqual(['delta', 'crisis', 'done']);
    expect(dataOf(events, 'delta')?.text).toBe(crisisReply('hinglish'));
  });

  it('two concurrent retries of the same message save only one reply', async () => {
    let healthy = false;
    const ai = fakeAi({
      stream: () => (healthy ? chunks(['Here.'], 50) : failing(new AiError('unavailable', 500))),
    });
    const app = ctx.app({ ai: ai.client });
    const { accessToken } = await signup(app);
    const conversation = await newConversation(app, accessToken);
    await send(app, accessToken, conversation.id, { text: 'hello?' });
    const [userMessage] = await messagesOf(conversation.id);

    healthy = true;
    const results = await Promise.all([
      send(app, accessToken, conversation.id, { text: 'hello?', retryOf: userMessage?.id }),
      send(app, accessToken, conversation.id, { text: 'hello?', retryOf: userMessage?.id }),
    ]);
    const saved = await messagesOf(conversation.id);
    expect(saved.map((m) => m.role)).toEqual(['user', 'assistant']);
    const done = results.filter((r) => r.types.includes('done'));
    expect(done).toHaveLength(1);
    const [row] = await ctx.db.select().from(conversations).where(eq(conversations.id, conversation.id));
    expect(row?.messageCount).toBe(2);
  });

  it('a failed label update after the reply is saved still sends meta and done', async () => {
    const ai = fakeAi({
      json: {
        classify: () => {
          // The next db.update is the mood/action label update: make it fail once.
          vi.spyOn(ctx.db, 'update').mockImplementationOnce(() => {
            throw Object.assign(new Error('connection reset'), { cause: { code: '08006' } });
          });
          return { mood: 3, suggested_action: 'none', title: 'Quiet evening' };
        },
      },
    });
    const { lines, logger } = captureLogs();
    const app = ctx.app({ ai: ai.client, logger });
    const { accessToken } = await signup(app);
    const conversation = await newConversation(app, accessToken);

    const { types } = await send(app, accessToken, conversation.id, { text: 'quiet evening' });
    vi.restoreAllMocks();
    expect(types).toEqual(['delta', 'delta', 'delta', 'meta', 'done']);
    expect((await messagesOf(conversation.id)).map((m) => m.role)).toEqual(['user', 'assistant']);
    const failure = lines.find((line) => line.includes('saving reply labels failed'));
    expect(failure).toContain('08006');
    expect(failure).not.toContain('connection reset');
  });

  it('opens the stream with a comment right away', async () => {
    const app = ctx.app({ ai: fakeAi().client });
    const { accessToken } = await signup(app);
    const conversation = await newConversation(app, accessToken);
    const { opened, response } = await send(app, accessToken, conversation.id, { text: 'hi' });
    expect(opened).toBe(true);
    expect(response.headers['cache-control']).toBe('no-cache, no-transform');
  });

  it('never logs message text or replies', async () => {
    const { lines, logger } = captureLogs();
    const ai = fakeAi({ stream: (r) => (r.model === P ? failing(new AiError('rate_limited', 429)) : chunks(['SECRET-REPLY'])) });
    const app = ctx.app({ ai: ai.client, logger });
    const { accessToken } = await signup(app);
    const conversation = await newConversation(app, accessToken);
    await send(app, accessToken, conversation.id, { text: 'SECRET-TEXT about my family' });
    await send(app, accessToken, conversation.id, { text: 'SECRET-CRISIS i want to die' });
    const all = lines.join('\n');
    expect(all).toContain('ai call failed');
    expect(all).not.toContain('SECRET');
  });
});

describe('conversation routes', () => {
  it('you can’t read, post to or delete another user’s conversation (404)', async () => {
    const ai = fakeAi();
    const app = ctx.app({ ai: ai.client });
    const owner = await signup(app);
    const intruder = await signup(app);
    const conversation = await newConversation(app, owner.accessToken);
    await send(app, owner.accessToken, conversation.id, { text: 'private' });
    const callsBefore = ai.callCount;

    for (const [method, url, payload] of [
      ['GET', `/conversations/${conversation.id}/messages`, undefined],
      ['POST', `/conversations/${conversation.id}/messages`, { text: 'hi' }],
      ['DELETE', `/conversations/${conversation.id}`, undefined],
      ['GET', '/conversations/not-a-uuid/messages', undefined],
      ['DELETE', '/conversations/00000000-0000-4000-8000-000000000000', undefined],
    ] as const) {
      const response = await app.inject({ method, url, headers: bearer(intruder.accessToken), payload });
      expect(response.statusCode, `${method} ${url}`).toBe(404);
      expect(errorResponseSchema.parse(response.json()).error.code).toBe('not_found');
    }
    expect(ai.callCount).toBe(callsBefore);
    expect(await messagesOf(conversation.id)).toHaveLength(2);

    const list = await app.inject({ method: 'GET', url: '/conversations', headers: bearer(intruder.accessToken) });
    expect(listConversationsResponseSchema.parse(list.json()).items).toEqual([]);
  });

  it('delete cascades messages; delete all leaves zero conversations for that user only', async () => {
    const app = ctx.app({ ai: fakeAi().client });
    const me = await signup(app);
    const other = await signup(app);
    const first = await newConversation(app, me.accessToken);
    const second = await newConversation(app, me.accessToken);
    const third = await newConversation(app, me.accessToken);
    const theirs = await newConversation(app, other.accessToken);
    for (const c of [first, second, third]) await send(app, me.accessToken, c.id, { text: 'hello' });
    await send(app, other.accessToken, theirs.id, { text: 'hello' });

    const one = await app.inject({ method: 'DELETE', url: `/conversations/${first.id}`, headers: bearer(me.accessToken) });
    expect(one.statusCode).toBe(204);
    expect(await messagesOf(first.id)).toHaveLength(0);
    expect(await messagesOf(second.id)).toHaveLength(2);

    const all = await app.inject({ method: 'DELETE', url: '/conversations', headers: bearer(me.accessToken) });
    expect(all.statusCode).toBe(204);
    const [mine] = await ctx.db.select({ n: count() }).from(conversations).where(eq(conversations.userId, me.user.id));
    expect(mine?.n).toBe(0);
    expect(await messagesOf(third.id)).toHaveLength(0);

    const [theirsLeft] = await ctx.db.select({ n: count() }).from(conversations).where(eq(conversations.userId, other.user.id));
    expect(theirsLeft?.n).toBe(1);
    expect(await messagesOf(theirs.id)).toHaveLength(2);
  });

  it('lists conversations, most recent first, with title and preview', async () => {
    const app = ctx.app({ ai: fakeAi().client });
    const { accessToken } = await signup(app);
    const older = await newConversation(app, accessToken);
    const empty = await newConversation(app, accessToken);
    await send(app, accessToken, older.id, { text: 'exam stress' });

    const response = await app.inject({ method: 'GET', url: '/conversations', headers: bearer(accessToken) });
    const body = listConversationsResponseSchema.parse(response.json());
    expect(body.items.map((i) => i.id)).toEqual([older.id, empty.id]);
    expect(body.items[0]).toMatchObject({ title: 'Exam night nerves', preview: DEFAULT_REPLY.join('') });
    expect(body.items[1]).toMatchObject({ title: null, preview: null });
    expect(body.nextCursor).toBeNull();
  });

  it('conversation pagination cursors return each item once', async () => {
    const app = ctx.app({ ai: fakeAi().client });
    const { user, accessToken } = await signup(app);
    // Seven conversations, two of them with the same timestamp, to exercise the id tiebreak.
    const same = new Date('2026-11-05T10:00:00Z');
    const ids: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      const [row] = await ctx.db
        .insert(conversations)
        .values({ userId: user.id, lastMessageAt: i < 2 ? same : new Date(Date.UTC(2026, 10, 1, i)) })
        .returning();
      ids.push(row!.id);
    }

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const query: string = cursor ? `?limit=3&cursor=${cursor}` : '?limit=3';
      const response = await app.inject({ method: 'GET', url: `/conversations${query}`, headers: bearer(accessToken) });
      expect(response.statusCode).toBe(200);
      const body = listConversationsResponseSchema.parse(response.json());
      seen.push(...body.items.map((i) => i.id));
      cursor = body.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);

    expect(pages).toBe(3);
    expect(seen).toHaveLength(7);
    expect(new Set(seen)).toEqual(new Set(ids));

    const bad = await app.inject({ method: 'GET', url: '/conversations?cursor=nope', headers: bearer(accessToken) });
    expect(bad.statusCode).toBe(400);
    expect(errorResponseSchema.parse(bad.json()).error.code).toBe('invalid_cursor');
  });

  it('message pagination cursors return each message once, newest first', async () => {
    const app = ctx.app({ ai: fakeAi().client });
    const { accessToken } = await signup(app);
    const conversation = await newConversation(app, accessToken);
    // Through the real route, so the timestamps are the ones production writes.
    for (let i = 0; i < 4; i += 1) await send(app, accessToken, conversation.id, { text: `m${i}` });
    const expected = (await messagesOf(conversation.id)).map((m) => m.id).reverse();
    expect(expected).toHaveLength(8);

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const url: string = `/conversations/${conversation.id}/messages?limit=3${cursor ? `&cursor=${cursor}` : ''}`;
      const response = await app.inject({ method: 'GET', url, headers: bearer(accessToken) });
      const body = listMessagesResponseSchema.parse(response.json());
      seen.push(...body.items.map((m) => m.id));
      cursor = body.nextCursor;
    } while (cursor);
    expect(seen).toEqual(expected);

    // A cursor from another conversation is rejected.
    const elsewhere = await newConversation(app, accessToken);
    const response = await app.inject({
      method: 'GET',
      url: `/conversations/${elsewhere.id}/messages?cursor=${expected[0]}`,
      headers: bearer(accessToken),
    });
    expect(response.statusCode).toBe(400);
  });

  it('every chat route requires a token', async () => {
    const app = ctx.app({ ai: fakeAi().client });
    const id = '00000000-0000-4000-8000-000000000000';
    for (const [method, url] of [
      ['GET', '/conversations'],
      ['POST', '/conversations'],
      ['DELETE', '/conversations'],
      ['GET', `/conversations/${id}/messages`],
      ['POST', `/conversations/${id}/messages`],
      ['DELETE', `/conversations/${id}`],
    ] as const) {
      const response = await app.inject({ method, url, payload: method === 'POST' ? { text: 'x' } : undefined });
      expect(response.statusCode, `${method} ${url}`).toBe(401);
    }
  });
});

describe('toTurns', () => {
  it('starts with the user and merges consecutive turns of the same role', () => {
    expect(
      toTurns([
        { role: 'assistant', content: 'a0' },
        { role: 'user', content: 'u1' },
        { role: 'user', content: 'u2' },
        { role: 'assistant', content: 'a3' },
      ]),
    ).toEqual([
      { role: 'user', text: 'u1\n\nu2' },
      { role: 'assistant', text: 'a3' },
    ]);
  });
});

