import {
  authResponseSchema,
  errorResponseSchema,
  refreshResponseSchema,
  userSchema,
} from '@solace/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createTokenService } from '../auth/tokens';
import { refreshTokens, userSettings, users } from '../db/schema';
import { bearer, PASSWORD, signup, signupBody, useTestDb } from '../test/helpers';

const ctx = useTestDb();

const errorOf = (response: { json: () => unknown }) => errorResponseSchema.parse(response.json()).error;

describe('POST /auth/signup', () => {
  it('returns the user and both tokens', async () => {
    const app = ctx.app();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: signupBody({ email: 'asha@example.com', name: 'Asha' }),
    });

    expect(response.statusCode).toBe(201);
    const body = authResponseSchema.parse(response.json());
    expect(body.user).toMatchObject({
      email: 'asha@example.com',
      name: 'Asha',
      goal: null,
      personalize: true,
      timezone: 'UTC',
    });
    expect(body.accessToken.split('.')).toHaveLength(3);
    expect(body.refreshToken.length).toBeGreaterThanOrEqual(43);
    expect(Object.keys(response.json().user).sort()).toEqual(Object.keys(userSchema.shape).sort());
  });

  it('stores goal, timezone and reminders when given', async () => {
    const app = ctx.app();
    const reminders = {
      checkin: { on: true, time: '21:15' },
      affirmation: { on: false, time: '08:00' },
      breathe: { on: true, time: '14:30' },
      custom: [{ id: 'water', label: 'Drink water', time: '11:00', on: true }],
    };
    const { user } = await signup(app, { goal: 'sleep', timezone: 'Asia/Kolkata', reminders });

    expect(user).toMatchObject({ goal: 'sleep', timezone: 'Asia/Kolkata' });
    const [row] = await ctx.db.select().from(userSettings).where(eq(userSettings.userId, user.id));
    expect(row?.reminders).toEqual(reminders);
  });

  it('returns 409 for a duplicate email, in any case', async () => {
    const app = ctx.app();
    await signup(app, { email: 'dup@example.com' });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: signupBody({ email: 'DUP@Example.com' }),
    });

    expect(response.statusCode).toBe(409);
    expect(errorOf(response).code).toBe('email_taken');
  });

  it('returns 400 when isAdult is false', async () => {
    const response = await ctx.app().inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { ...signupBody(), isAdult: false },
    });

    expect(response.statusCode).toBe(400);
    expect(errorOf(response).code).toBe('invalid_request');
    expect(await ctx.db.select().from(users)).toHaveLength(0);
  });

  it('returns 400 when isAdult is missing', async () => {
    const { isAdult: _omit, ...payload } = signupBody();
    const response = await ctx.app().inject({ method: 'POST', url: '/auth/signup', payload });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 for a password under 8 characters', async () => {
    const response = await ctx.app().inject({
      method: 'POST',
      url: '/auth/signup',
      payload: signupBody({ password: 'short12' }),
    });

    expect(response.statusCode).toBe(400);
    expect(errorOf(response)).toMatchObject({ code: 'invalid_request' });
    expect(errorOf(response).message).toContain('password');
    expect(await ctx.db.select().from(users)).toHaveLength(0);
  });

  it('returns 400 for an invalid email, an unknown time zone or an unknown field', async () => {
    const app = ctx.app();
    for (const payload of [
      signupBody({ email: 'not-an-email' }),
      signupBody({ timezone: 'Mars/Olympus' }),
      { ...signupBody(), admin: true },
    ]) {
      const response = await app.inject({ method: 'POST', url: '/auth/signup', payload });
      expect(response.statusCode).toBe(400);
      expect(errorOf(response).code).toBe('invalid_request');
    }
  });

  it('stores the email lowercased and hashes the password with argon2id', async () => {
    const app = ctx.app();
    const { user } = await signup(app, { email: '  Mixed.Case@Example.COM ' });

    expect(user.email).toBe('mixed.case@example.com');
    const [row] = await ctx.db.select().from(users).where(eq(users.id, user.id));
    expect(row?.email).toBe('mixed.case@example.com');
    expect(row?.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(row?.passwordHash).not.toContain(PASSWORD);
  });

  it('stores only a hash of the refresh token, valid for 30 days', async () => {
    const app = ctx.app();
    const { user, refreshToken } = await signup(app);

    const rows = await ctx.db.select().from(refreshTokens).where(eq(refreshTokens.userId, user.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]?.tokenHash).not.toBe(refreshToken);
    expect(rows[0]?.expiresAt.getTime()).toBe(ctx.clock.now.getTime() + 30 * 24 * 60 * 60 * 1000);
  });
});

describe('POST /auth/login', () => {
  it('signs in with the right password, whatever the email case', async () => {
    const app = ctx.app();
    const created = await signup(app, { email: 'login@example.com' });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'Login@Example.com', password: PASSWORD },
    });

    expect(response.statusCode).toBe(200);
    const body = authResponseSchema.parse(response.json());
    expect(body.user.id).toBe(created.user.id);
    const me = await app.inject({ method: 'GET', url: '/me', headers: bearer(body.accessToken) });
    expect(me.statusCode).toBe(200);
  });

  it('returns the same 401 for a wrong password and an unknown email', async () => {
    const app = ctx.app();
    await signup(app, { email: 'known@example.com' });

    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'known@example.com', password: 'wrong password!' },
    });
    const unknownEmail = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nobody@example.com', password: PASSWORD },
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(errorOf(wrongPassword)).toEqual(errorOf(unknownEmail));
    expect(errorOf(wrongPassword).code).toBe('invalid_credentials');
  });
});

describe('POST /auth/refresh', () => {
  it('returns a new pair, and the old refresh token stops working', async () => {
    const app = ctx.app();
    const first = await signup(app);

    const refreshed = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: first.refreshToken },
    });
    expect(refreshed.statusCode).toBe(200);
    const pair = refreshResponseSchema.parse(refreshed.json());
    expect(pair.refreshToken).not.toBe(first.refreshToken);

    const me = await app.inject({ method: 'GET', url: '/me', headers: bearer(pair.accessToken) });
    expect(me.statusCode).toBe(200);

    const again = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: first.refreshToken },
    });
    expect(again.statusCode).toBe(401);
    expect(errorOf(again).code).toBe('invalid_refresh_token');
  });

  it('reusing a rotated token revokes the newer token too (whole family)', async () => {
    const app = ctx.app();
    const first = await signup(app);
    // A second session (another device) must survive the first one's family being revoked.
    const otherDevice = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: first.user.email, password: PASSWORD },
    });
    const other = authResponseSchema.parse(otherDevice.json());

    const second = refreshResponseSchema.parse(
      (
        await app.inject({
          method: 'POST',
          url: '/auth/refresh',
          payload: { refreshToken: first.refreshToken },
        })
      ).json(),
    );

    const reuse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: first.refreshToken },
    });
    expect(reuse.statusCode).toBe(401);

    const newer = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: second.refreshToken },
    });
    expect(newer.statusCode).toBe(401);

    const untouched = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: other.refreshToken },
    });
    expect(untouched.statusCode).toBe(200);
  });

  it('returns 401 for an unknown token and for an expired one', async () => {
    const app = ctx.app();
    const unknown = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: 'not-a-real-token' },
    });
    expect(unknown.statusCode).toBe(401);

    const { refreshToken } = await signup(app);
    ctx.clock.now = new Date(ctx.clock.now.getTime() + 31 * 24 * 60 * 60 * 1000);
    const expired = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });
    expect(expired.statusCode).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('returns 204, and refreshing with that token afterwards returns 401', async () => {
    const app = ctx.app();
    const { refreshToken } = await signup(app);

    const logout = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: { refreshToken },
    });
    expect(logout.statusCode).toBe(204);
    expect(logout.body).toBe('');

    const refresh = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });
    expect(refresh.statusCode).toBe(401);
  });

  it('returns 204 for an unknown token', async () => {
    const response = await ctx.app().inject({
      method: 'POST',
      url: '/auth/logout',
      payload: { refreshToken: 'unknown' },
    });
    expect(response.statusCode).toBe(204);
  });
});

describe('protected routes', () => {
  it('return 401 with no token, a malformed header, a bad signature or an expired token', async () => {
    const app = ctx.app();
    const { user, accessToken } = await signup(app);

    const forged = await createTokenService({
      db: ctx.db,
      jwtSecret: 'x'.repeat(64),
      clock: () => ctx.clock.now,
    }).signAccessToken(user.id);

    const [header, payload, signature] = accessToken.split('.');
    const tampered = `${header}.${payload}.${signature?.slice(0, -2)}${signature?.endsWith('AA') ? 'BB' : 'AA'}`;

    for (const headers of [
      {},
      { authorization: accessToken },
      { authorization: 'Basic abc' },
      bearer(forged),
      bearer(tampered),
    ]) {
      const response = await app.inject({ method: 'GET', url: '/me', headers });
      expect(response.statusCode).toBe(401);
      expect(errorOf(response).code).toBe('unauthorized');
    }

    ctx.clock.now = new Date(ctx.clock.now.getTime() + 15 * 60 * 1000 + 1000);
    const expired = await app.inject({ method: 'GET', url: '/me', headers: bearer(accessToken) });
    expect(expired.statusCode).toBe(401);
  });

  it('return 200 with a valid token', async () => {
    const app = ctx.app();
    const { accessToken } = await signup(app);

    ctx.clock.now = new Date(ctx.clock.now.getTime() + 14 * 60 * 1000);
    for (const url of ['/me', '/me/settings']) {
      const response = await app.inject({ method: 'GET', url, headers: bearer(accessToken) });
      expect(response.statusCode).toBe(200);
    }
  });

  it('every protected route rejects a missing token', async () => {
    const app = ctx.app();
    for (const [method, url] of [
      ['GET', '/me'],
      ['PATCH', '/me'],
      ['DELETE', '/me'],
      ['GET', '/me/settings'],
      ['PUT', '/me/settings'],
    ] as const) {
      const response = await app.inject({ method, url, payload: method === 'GET' || method === 'DELETE' ? undefined : {} });
      expect(response.statusCode, `${method} ${url}`).toBe(401);
    }
  });
});

describe('refresh race', () => {
  it('two concurrent refreshes with one token: one wins, and the winner is revoked too', async () => {
    const app = ctx.app();
    const { refreshToken } = await signup(app);
    const refresh = (token: string) =>
      app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: token } });

    const results = await Promise.all([refresh(refreshToken), refresh(refreshToken)]);
    const statuses = results.map((r) => r.statusCode).sort();
    expect(statuses).toEqual([200, 401]);

    const winner = refreshResponseSchema.parse(results.find((r) => r.statusCode === 200)!.json());
    // The loser presented an already-claimed token, so the family (including the winner's new
    // token) is revoked.
    const afterwards = await refresh(winner.refreshToken);
    expect(afterwards.statusCode).toBe(401);

    const live = await ctx.db.select().from(refreshTokens);
    expect(live.filter((row) => row.revokedAt === null)).toHaveLength(0);
  });
});

describe('time zones', () => {
  it('rejects offsets, abbreviations and pseudo-zones with 400', async () => {
    const app = ctx.app();
    for (const timezone of ['+05:30', 'UTC+5:30', 'GMT+5', 'IST', 'Etc/GMT-5', 'EST5EDT', 'Asia']) {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: signupBody({ timezone }),
      });
      expect(response.statusCode, timezone).toBe(400);
      expect(errorOf(response).code).toBe('invalid_request');
    }
    expect(await ctx.db.select().from(users)).toHaveLength(0);
  });

  it('stores the canonical IANA name for aliases and odd casing', async () => {
    const app = ctx.app();
    for (const [given, stored] of [
      ['Asia/Calcutta', 'Asia/Kolkata'],
      ['asia/kolkata', 'Asia/Kolkata'],
      ['US/Pacific', 'America/Los_Angeles'],
      ['Europe/Kiev', 'Europe/Kyiv'],
      ['Etc/UTC', 'UTC'],
      ['utc', 'UTC'],
    ] as const) {
      const { user } = await signup(app, { timezone: given });
      expect(user.timezone, given).toBe(stored);
      const [row] = await ctx.db.select().from(users).where(eq(users.id, user.id));
      expect(row?.timezone).toBe(stored);
    }
  });
});
