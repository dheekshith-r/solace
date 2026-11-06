import {
  DEFAULT_REMINDERS,
  errorResponseSchema,
  meResponseSchema,
  settingsResponseSchema,
  updateMeResponseSchema,
} from '@solace/shared';
import { count, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  activityLog,
  assessments,
  conversations,
  dailyAffirmations,
  messages,
  moodCheckins,
  refreshTokens,
  userSettings,
  users,
} from '../db/schema';
import { bearer, signup, useTestDb } from '../test/helpers';

const ctx = useTestDb();

const reminders = {
  checkin: { on: true, time: '07:45' },
  affirmation: { on: true, time: '09:00' },
  breathe: { on: false, time: '22:10' },
  custom: [
    { id: 'c1', label: 'Stretch', time: '16:00', on: true },
    { id: 'c2', label: 'Call mom', time: '19:30', on: false },
  ],
};

describe('GET /me', () => {
  it('returns the user and fresh stats', async () => {
    const app = ctx.app();
    const { user, accessToken } = await signup(app, { name: 'Ravi' });

    const response = await app.inject({ method: 'GET', url: '/me', headers: bearer(accessToken) });

    expect(response.statusCode).toBe(200);
    const body = meResponseSchema.parse(response.json());
    expect(body.user).toEqual(user);
    expect(body.stats).toEqual({ xp: 0, level: 1, streak: 0, xpToNext: 100 });
  });

  it('returns 401 once the account is gone', async () => {
    const app = ctx.app();
    const { user, accessToken } = await signup(app);
    await ctx.db.delete(users).where(eq(users.id, user.id));

    const response = await app.inject({ method: 'GET', url: '/me', headers: bearer(accessToken) });
    expect(response.statusCode).toBe(401);
  });

  it('every /me route returns 401 once the account is gone, settings included', async () => {
    const app = ctx.app();
    const { user, accessToken } = await signup(app);
    await ctx.db.delete(users).where(eq(users.id, user.id));

    for (const [method, url, payload] of [
      ['GET', '/me/settings', undefined],
      ['PUT', '/me/settings', { reminders }],
      ['PATCH', '/me', { name: 'Ghost' }],
    ] as const) {
      const response = await app.inject({ method, url, headers: bearer(accessToken), payload });
      expect(response.statusCode, `${method} ${url}`).toBe(401);
      expect(errorResponseSchema.parse(response.json()).error.code).toBe('unauthorized');
    }
  });
});

describe('PATCH /me', () => {
  it('updates name, goal, personalize and timezone', async () => {
    const app = ctx.app();
    const { user, accessToken } = await signup(app);

    const response = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: bearer(accessToken),
      payload: { name: 'Meera', goal: 'focus', personalize: false, timezone: 'Asia/Kolkata' },
    });

    expect(response.statusCode).toBe(200);
    expect(updateMeResponseSchema.parse(response.json()).user).toEqual({
      ...user,
      name: 'Meera',
      goal: 'focus',
      personalize: false,
      timezone: 'Asia/Kolkata',
    });
    const [row] = await ctx.db.select().from(users).where(eq(users.id, user.id));
    expect(row).toMatchObject({
      name: 'Meera',
      goal: 'focus',
      personalize: false,
      timezone: 'Asia/Kolkata',
    });
  });

  it('canonicalizes a time zone alias', async () => {
    const app = ctx.app();
    const { accessToken } = await signup(app);

    const response = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: bearer(accessToken),
      payload: { timezone: 'Asia/Calcutta' },
    });

    expect(response.statusCode).toBe(200);
    expect(updateMeResponseSchema.parse(response.json()).user.timezone).toBe('Asia/Kolkata');
  });

  it('changes only the fields sent', async () => {
    const app = ctx.app();
    const { user, accessToken } = await signup(app, { goal: 'calm' });

    const response = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: bearer(accessToken),
      payload: { personalize: false },
    });

    expect(updateMeResponseSchema.parse(response.json()).user).toEqual({
      ...user,
      personalize: false,
    });
  });

  it('rejects unknown fields and invalid values with 400', async () => {
    const app = ctx.app();
    const { user, accessToken } = await signup(app, { email: 'keep@example.com' });

    for (const payload of [
      { email: 'new@example.com' },
      { name: 'Ok', xp: 9999 },
      { passwordHash: 'x' },
      { goal: 'world-domination' },
      { timezone: 'Not/AZone' },
      { timezone: '+05:30' },
      { name: '' },
    ]) {
      const response = await app.inject({
        method: 'PATCH',
        url: '/me',
        headers: bearer(accessToken),
        payload,
      });
      expect(response.statusCode, JSON.stringify(payload)).toBe(400);
      expect(errorResponseSchema.parse(response.json()).error.code).toBe('invalid_request');
    }

    const [row] = await ctx.db.select().from(users).where(eq(users.id, user.id));
    expect(row).toMatchObject({ email: 'keep@example.com', name: 'Asha', xp: 0 });
  });
});

describe('DELETE /me', () => {
  it('deletes the account and cascades to every child table', async () => {
    const app = ctx.app();
    const { user, accessToken, refreshToken } = await signup(app, { reminders });
    const other = await signup(app);

    for (const userId of [user.id, other.user.id]) {
      await ctx.db.insert(moodCheckins).values({ userId, mood: 4, source: 'home' });
      await ctx.db
        .insert(assessments)
        .values({ userId, answers: [1, 2, 0, 1], score: 4, band: 'stretched' });
      const [conversation] = await ctx.db
        .insert(conversations)
        .values({ userId, title: 'Exams' })
        .returning();
      await ctx.db
        .insert(messages)
        .values({ conversationId: conversation!.id, role: 'user', content: 'hi' });
      await ctx.db.insert(activityLog).values({ userId, kind: 'checkin', xpAwarded: 10 });
      await ctx.db.insert(dailyAffirmations).values({ userId, date: '2026-11-06', text: 'Breathe.' });
    }

    const response = await app.inject({
      method: 'DELETE',
      url: '/me',
      headers: bearer(accessToken),
    });
    expect(response.statusCode).toBe(204);

    const counts = await Promise.all(
      [
        [users, users.id],
        [refreshTokens, refreshTokens.userId],
        [moodCheckins, moodCheckins.userId],
        [assessments, assessments.userId],
        [conversations, conversations.userId],
        [activityLog, activityLog.userId],
        [dailyAffirmations, dailyAffirmations.userId],
        [userSettings, userSettings.userId],
      ].map(async ([table, column]) => {
        const [row] = await ctx.db
          .select({ n: count() })
          .from(table as typeof users)
          .where(eq(column as typeof users.id, user.id));
        return row?.n;
      }),
    );
    expect(counts).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);

    // Messages hang off conversations: only the other user's message is left.
    const [messageCount] = await ctx.db.select({ n: count() }).from(messages);
    expect(messageCount?.n).toBe(1);

    // The other account is untouched.
    const [otherCheckins] = await ctx.db
      .select({ n: count() })
      .from(moodCheckins)
      .where(eq(moodCheckins.userId, other.user.id));
    expect(otherCheckins?.n).toBe(1);

    const refresh = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });
    expect(refresh.statusCode).toBe(401);
  });
});

describe('settings', () => {
  it('GET returns the defaults before anything is saved', async () => {
    const app = ctx.app();
    const { accessToken } = await signup(app);

    const response = await app.inject({
      method: 'GET',
      url: '/me/settings',
      headers: bearer(accessToken),
    });

    expect(response.statusCode).toBe(200);
    expect(settingsResponseSchema.parse(response.json())).toEqual({ reminders: DEFAULT_REMINDERS });
  });

  it('PUT then GET round-trips the reminders JSON', async () => {
    const app = ctx.app();
    const { accessToken } = await signup(app);

    const put = await app.inject({
      method: 'PUT',
      url: '/me/settings',
      headers: bearer(accessToken),
      payload: { reminders },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toEqual({ reminders });

    const updated = { ...reminders, custom: [], breathe: { on: true, time: '06:00' } };
    const second = await app.inject({
      method: 'PUT',
      url: '/me/settings',
      headers: bearer(accessToken),
      payload: { reminders: updated },
    });
    expect(second.statusCode).toBe(200);

    const get = await app.inject({
      method: 'GET',
      url: '/me/settings',
      headers: bearer(accessToken),
    });
    expect(get.statusCode).toBe(200);
    expect(get.json()).toEqual({ reminders: updated });
  });

  it('returns 400 for an invalid time or a malformed reminders object', async () => {
    const app = ctx.app();
    const { accessToken } = await signup(app);

    for (const bad of [
      { ...reminders, checkin: { on: true, time: '25:00' } },
      { ...reminders, checkin: { on: true, time: '7:45' } },
      { ...reminders, custom: [{ id: 'x', label: 'Walk', time: '12:60', on: true }] },
      { ...reminders, breathe: undefined },
      { ...reminders, extra: true },
    ]) {
      const response = await app.inject({
        method: 'PUT',
        url: '/me/settings',
        headers: bearer(accessToken),
        payload: { reminders: bad },
      });
      expect(response.statusCode, JSON.stringify(bad)).toBe(400);
      expect(errorResponseSchema.parse(response.json()).error.code).toBe('invalid_request');
    }

    const get = await app.inject({
      method: 'GET',
      url: '/me/settings',
      headers: bearer(accessToken),
    });
    expect(get.json()).toEqual({ reminders: DEFAULT_REMINDERS });
  });
});
