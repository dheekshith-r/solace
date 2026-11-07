import {
  assessmentBand,
  assessmentResponseSchema,
  errorResponseSchema,
  needsSupport,
} from '@solace/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { FALLBACK_MOVES } from '../ai/fallbacks';
import { activityLog, assessments, conversations, moodCheckins, users } from '../db/schema';
import { fakeAi, unavailable } from '../test/fake-ai';
import { bearer, signup, useTestDb, type TestApp } from '../test/helpers';

const ctx = useTestDb();

async function reflect(app: TestApp, token: string, payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/assessments', headers: bearer(token), payload });
}

async function reflectOk(app: TestApp, token: string, payload: Record<string, unknown>) {
  const response = await reflect(app, token, payload);
  expect(response.statusCode).toBe(201);
  return assessmentResponseSchema.parse(response.json());
}

describe('scoring', () => {
  it('bands: 0-4 steady, 5-8 stretched, 9-12 strained', () => {
    const bands = Array.from({ length: 13 }, (_, score) => assessmentBand(score));
    expect(bands).toEqual([
      ...Array(5).fill('steady'),
      ...Array(4).fill('stretched'),
      ...Array(4).fill('strained'),
    ]);
  });

  it('support: any strained result, or a 3 on mood question 2 (and only the mood check)', () => {
    expect(needsSupport('mood', [0, 3, 0, 0], 'steady')).toBe(true);
    expect(needsSupport('mood', [3, 2, 0, 0], 'stretched')).toBe(false);
    expect(needsSupport('anxiety', [0, 3, 0, 0], 'steady')).toBe(false);
    expect(needsSupport('self_talk', [0, 3, 0, 0], 'steady')).toBe(false);
    expect(needsSupport('anxiety', [3, 3, 3, 0], 'strained')).toBe(true);
  });
});

describe('POST /assessments', () => {
  it('scores, saves kind and moves, returns three Flash-Lite moves and logs the activity once', async () => {
    const ai = fakeAi();
    const app = ctx.app({ ai: ai.client });
    const { user, accessToken } = await signup(app);

    const body = await reflectOk(app, accessToken, { kind: 'anxiety', answers: [2, 1, 2, 1] });
    expect(body.assessment).toMatchObject({ kind: 'anxiety', score: 6, band: 'stretched' });
    expect(body.support).toBe(false);
    expect(body.moves).toHaveLength(3);
    expect(body.moves.map((m) => m.action)).toEqual(['breathe', 'chat', 'checkin']);
    expect(ai.jsonCalls('moves')).toHaveLength(1);
    expect(ai.jsonCalls('moves')[0]?.model).toBe('lite');
    expect(ai.jsonCalls('moves')[0]?.prompt).toContain('Answers: 2, 1, 2, 1 (score 6 of 12, band: stretched)');

    const [row] = await ctx.db.select().from(assessments).where(eq(assessments.userId, user.id));
    expect(row).toMatchObject({ id: body.assessment.id, kind: 'anxiety', score: 6, band: 'stretched' });
    expect(row?.moves).toEqual(body.moves);
    const logged = await ctx.db.select().from(activityLog).where(eq(activityLog.userId, user.id));
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ kind: 'assessment', xpAwarded: 20 });
    expect(logged[0]?.meta).toEqual({ assessmentId: body.assessment.id, kind: 'anxiety', band: 'stretched' });
  });

  it.each([
    [[0, 0, 0, 0], 0, 'steady'],
    [[1, 1, 1, 1], 4, 'steady'],
    [[2, 1, 1, 1], 5, 'stretched'],
    [[2, 2, 2, 2], 8, 'stretched'],
    [[3, 2, 2, 2], 9, 'strained'],
    [[3, 3, 3, 3], 12, 'strained'],
  ])('band boundary: answers %j score %i -> %s', async (answers, score, band) => {
    const app = ctx.app({ ai: fakeAi().client });
    const { accessToken } = await signup(app);
    const body = await reflectOk(app, accessToken, { kind: 'self_talk', answers });
    expect(body.assessment).toMatchObject({ score, band });
    expect(body.support).toBe(band === 'strained');
  });

  it('Q2 rule: a 3 on the second mood question shows support even when the band is steady', async () => {
    const app = ctx.app({ ai: fakeAi().client });
    const { accessToken } = await signup(app);
    const mood = await reflectOk(app, accessToken, { kind: 'mood', answers: [0, 3, 0, 0] });
    expect(mood.assessment.band).toBe('steady');
    expect(mood.support).toBe(true);
    const anxiety = await reflectOk(app, accessToken, { kind: 'anxiety', answers: [0, 3, 0, 0] });
    expect(anxiety.support).toBe(false);
  });

  it.each([
    ['Gemini fails', unavailable],
    ['Gemini returns two moves', () => ({ moves: [{ text: 'One', action: 'chat' }, { text: 'Two', action: 'breathe' }] })],
    ['Gemini returns an unknown action', () => ({ moves: Array(3).fill({ text: 'Fly to the moon', action: 'rocket' }) })],
  ])('falls back to the handwritten moves for the band when %s', async (_case, handler) => {
    const ai = fakeAi({ json: { moves: handler } });
    const app = ctx.app({ ai: ai.client });
    const { accessToken } = await signup(app);
    const body = await reflectOk(app, accessToken, { kind: 'mood', answers: [3, 2, 3, 3] });
    expect(body.assessment.band).toBe('strained');
    expect(body.moves).toEqual(FALLBACK_MOVES.strained);
  });

  it('with personalize on, recent moods and chats go into the moves prompt', async () => {
    const ai = fakeAi();
    const app = ctx.app({ ai: ai.client });
    const { user, accessToken } = await signup(app);
    await ctx.db.insert(moodCheckins).values({ userId: user.id, mood: 2, note: 'MARKER exam week', source: 'home' });
    await ctx.db.insert(conversations).values({ userId: user.id, summary: 'MARKER summary of chats' });

    await reflectOk(app, accessToken, { kind: 'mood', answers: [1, 1, 2, 1] });
    const prompt = ai.jsonCalls('moves')[0]?.prompt ?? '';
    expect(prompt).toContain('MARKER exam week');
    expect(prompt).toContain('MARKER summary of chats');
  });

  it('with personalize off, no history goes into the moves prompt', async () => {
    const ai = fakeAi();
    const app = ctx.app({ ai: ai.client });
    const { user, accessToken } = await signup(app);
    await ctx.db.insert(moodCheckins).values({ userId: user.id, mood: 2, note: 'MARKER exam week', source: 'home' });
    await ctx.db.insert(conversations).values({ userId: user.id, summary: 'MARKER summary of chats' });
    await ctx.db.insert(assessments).values({ userId: user.id, answers: [3, 3, 3, 3], score: 12, band: 'strained' });
    await ctx.db.update(users).set({ personalize: false }).where(eq(users.id, user.id));

    await reflectOk(app, accessToken, { kind: 'mood', answers: [1, 1, 2, 1] });
    const call = ai.jsonCalls('moves')[0];
    const sent = `${call?.system}\n${call?.prompt}`;
    expect(sent).not.toContain('MARKER');
    expect(sent).not.toContain('Recent mood check-ins');
    expect(sent).not.toContain('Latest Reflect result');
    expect(sent).toContain('Answers: 1, 1, 2, 1');
  });

  it('awards 20 XP for the first 3 results of a local day, then 0, and every one is saved', async () => {
    const app = ctx.app({ ai: fakeAi().client });
    const { user, accessToken } = await signup(app);
    for (let i = 0; i < 4; i += 1) {
      await reflectOk(app, accessToken, { kind: 'mood', answers: [1, 1, 1, 1] });
    }
    const logged = await ctx.db.select().from(activityLog).where(eq(activityLog.userId, user.id));
    expect(logged.map((row) => row.xpAwarded).sort()).toEqual([0, 20, 20, 20]);
    const [row] = await ctx.db.select({ xp: users.xp }).from(users).where(eq(users.id, user.id));
    expect(row?.xp).toBe(60);
    const saved = await ctx.db.select().from(assessments).where(eq(assessments.userId, user.id));
    expect(saved).toHaveLength(4);
  });

  it('concurrent results can’t race past the daily XP cap', async () => {
    const app = ctx.app({ ai: fakeAi().client });
    const { user, accessToken } = await signup(app);
    await Promise.all(
      Array.from({ length: 5 }, () => reflectOk(app, accessToken, { kind: 'anxiety', answers: [0, 1, 0, 1] })),
    );
    const [row] = await ctx.db.select({ xp: users.xp }).from(users).where(eq(users.id, user.id));
    expect(row?.xp).toBe(60);
  });

  it('rejects malformed answers, unknown kinds and extra fields with 400', async () => {
    const ai = fakeAi();
    const app = ctx.app({ ai: ai.client });
    const { user, accessToken } = await signup(app);
    for (const payload of [
      { kind: 'mood', answers: [1, 1, 1] },
      { kind: 'mood', answers: [1, 1, 1, 1, 1] },
      { kind: 'mood', answers: [1, 1, 1, 4] },
      { kind: 'mood', answers: [1, 1, 1, -1] },
      { kind: 'mood', answers: [1, 1, 1, 1.5] },
      { kind: 'stress', answers: [1, 1, 1, 1] },
      { kind: 'mood', answers: [1, 1, 1, 1], note: 'hi' },
      { kind: 'mood', answers: [1, 1, 1, 1], score: 0 },
    ]) {
      const response = await reflect(app, accessToken, payload);
      expect(response.statusCode, JSON.stringify(payload)).toBe(400);
      expect(errorResponseSchema.parse(response.json()).error.code).toBe('invalid_request');
    }
    expect(await ctx.db.select().from(assessments).where(eq(assessments.userId, user.id))).toHaveLength(0);
    expect(ai.callCount).toBe(0);
  });

  it('requires a token', async () => {
    const app = ctx.app({ ai: fakeAi().client });
    const response = await app.inject({
      method: 'POST',
      url: '/assessments',
      payload: { kind: 'mood', answers: [1, 1, 1, 1] },
    });
    expect(response.statusCode).toBe(401);
  });
});
