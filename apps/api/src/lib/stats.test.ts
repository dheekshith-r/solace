import { meResponseSchema } from '@solace/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { activityLog, users } from '../db/schema';
import { bearer, signup, useTestDb } from '../test/helpers';
import { computeStreak, levelForXp, localDate } from './stats';

describe('levelForXp', () => {
  it.each([
    [0, 1, 100],
    [1, 1, 99],
    [99, 1, 1],
    [100, 2, 100],
    [250, 3, 50],
    [1000, 11, 100],
  ])('xp %i is level %i with %i to go', (xp, level, xpToNext) => {
    expect(levelForXp(xp)).toEqual({ level, xpToNext });
  });
});

describe('computeStreak', () => {
  const today = '2026-11-06';

  it('counts consecutive days including today', () => {
    expect(computeStreak(['2026-11-06', '2026-11-05', '2026-11-04', '2026-11-02'], today)).toBe(3);
  });

  it('keeps a streak that ended yesterday', () => {
    expect(computeStreak(['2026-11-05', '2026-11-04'], today)).toBe(2);
  });

  it('is zero when the last activity was two days ago or more', () => {
    expect(computeStreak(['2026-11-04', '2026-11-03'], today)).toBe(0);
    expect(computeStreak([], today)).toBe(0);
  });

  it('crosses month and year boundaries', () => {
    expect(computeStreak(['2026-01-01', '2025-12-31', '2025-12-30'], '2026-01-01')).toBe(3);
    expect(computeStreak(['2028-03-01', '2028-02-29', '2028-02-28'], '2028-03-01')).toBe(3);
  });
});

describe('localDate', () => {
  it('uses the given time zone', () => {
    const instant = new Date('2026-11-05T19:00:00Z');
    expect(localDate(instant, 'UTC')).toBe('2026-11-05');
    expect(localDate(instant, 'Asia/Kolkata')).toBe('2026-11-06');
    expect(localDate(instant, 'America/Los_Angeles')).toBe('2026-11-05');
  });
});

describe('GET /me stats (database)', () => {
  const ctx = useTestDb();

  async function statsFor(timezone: string, activity: string[], xp = 0) {
    const app = ctx.app();
    const { user, accessToken } = await signup(app, { timezone });
    await ctx.db.update(users).set({ xp }).where(eq(users.id, user.id));
    for (const at of activity) {
      await ctx.db
        .insert(activityLog)
        .values({ userId: user.id, kind: 'checkin', xpAwarded: 10, createdAt: new Date(at) });
    }
    const response = await app.inject({ method: 'GET', url: '/me', headers: bearer(accessToken) });
    expect(response.statusCode).toBe(200);
    return meResponseSchema.parse(response.json()).stats;
  }

  it('reports XP and level from the stored XP', async () => {
    ctx.clock.now = new Date('2026-11-06T06:00:00Z');
    expect(await statsFor('UTC', [], 250)).toEqual({ xp: 250, level: 3, streak: 0, xpToNext: 50 });
  });

  it('counts consecutive local days, several activities on one day counting once', async () => {
    ctx.clock.now = new Date('2026-11-06T12:00:00Z');
    const stats = await statsFor('UTC', [
      '2026-11-06T08:00:00Z',
      '2026-11-06T09:00:00Z',
      '2026-11-05T23:59:00Z',
      '2026-11-04T00:01:00Z',
      // Gap on Nov 3.
      '2026-11-02T10:00:00Z',
    ]);
    expect(stats.streak).toBe(3);
  });

  it('keeps a streak ending yesterday and drops one ending earlier', async () => {
    ctx.clock.now = new Date('2026-11-06T12:00:00Z');
    expect((await statsFor('UTC', ['2026-11-05T10:00:00Z', '2026-11-04T10:00:00Z'])).streak).toBe(2);
    expect((await statsFor('UTC', ['2026-11-04T10:00:00Z'])).streak).toBe(0);
  });

  it('Asia/Kolkata: activity at 23:30 and 00:30 local counts as two days', async () => {
    // 23:30 IST on Nov 5 and 00:30 IST on Nov 6: both fall on Nov 5 in UTC.
    const activity = ['2026-11-05T18:00:00Z', '2026-11-05T19:00:00Z'];
    // 11:30 IST on Nov 6.
    ctx.clock.now = new Date('2026-11-06T06:00:00Z');

    expect((await statsFor('Asia/Kolkata', activity)).streak).toBe(2);
    // Same instants for a UTC user are one day, which ended yesterday.
    expect((await statsFor('UTC', activity)).streak).toBe(1);
  });

  it('Asia/Kolkata: "today" is the local date, not the UTC one', async () => {
    // 00:30 IST on Nov 7 is still Nov 6 in UTC; activity on IST Nov 5 is now two days ago.
    ctx.clock.now = new Date('2026-11-06T19:00:00Z');
    expect((await statsFor('Asia/Kolkata', ['2026-11-05T10:00:00Z'])).streak).toBe(0);
    expect((await statsFor('Asia/Kolkata', ['2026-11-06T10:00:00Z'])).streak).toBe(1);
  });
});
