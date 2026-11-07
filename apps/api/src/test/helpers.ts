import { randomBytes } from 'node:crypto';
import { Writable } from 'node:stream';
import { authResponseSchema, type SignupRequest } from '@solace/shared';
import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, expect } from 'vitest';
import { type AppDeps, buildApp, loggerOptions } from '../app';
import { createDb } from '../db/client';
import { testDatabaseUrl } from './database';

const RELAXED_LIMITS = {
  auth: { max: 10_000, timeWindow: 60_000 },
  user: { max: 10_000, timeWindow: 60_000 },
  messages: { max: 10_000, timeWindow: 60_000 },
};

/**
 * Per-file test harness: one connection pool to the test database, a controllable clock,
 * and every table truncated before each test.
 */
export function useTestDb() {
  const database = createDb(testDatabaseUrl());
  const jwtSecret = randomBytes(32).toString('hex');
  const clock = { now: new Date('2026-11-06T06:00:00Z') };

  beforeEach(async () => {
    clock.now = new Date('2026-11-06T06:00:00Z');
    await database.db.execute(sql`
      truncate table
        users, refresh_tokens, mood_checkins, assessments, conversations,
        messages, activity_log, daily_affirmations, user_settings
      cascade
    `);
  });

  afterAll(async () => {
    await database.close();
  });

  function app(overrides: Partial<AppDeps> = {}) {
    return buildApp({
      pingDb: database.ping,
      db: database.db,
      jwtSecret,
      clock: () => clock.now,
      rateLimits: RELAXED_LIMITS,
      ...overrides,
    });
  }

  return { db: database.db, jwtSecret, clock, app };
}

export type TestApp = ReturnType<ReturnType<typeof useTestDb>['app']>;

export const PASSWORD = 'correct horse battery';

export function signupBody(overrides: Partial<SignupRequest> = {}): SignupRequest {
  return {
    email: `user-${randomBytes(4).toString('hex')}@example.com`,
    password: PASSWORD,
    name: 'Asha',
    isAdult: true,
    ...overrides,
  };
}

export async function signup(app: TestApp, overrides: Partial<SignupRequest> = {}) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/signup',
    payload: signupBody(overrides),
  });
  expect(response.statusCode).toBe(201);
  return authResponseSchema.parse(response.json());
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

export type ParsedSse = { event: string; data: unknown }[];

/** Splits an SSE body into its events. Heartbeat comments are counted separately. */
export function parseSse(body: string) {
  const events: ParsedSse = [];
  let heartbeats = 0;
  const opened = body.startsWith(': open\n\n');
  for (const block of body.split('\n\n')) {
    if (!block.trim()) continue;
    if (block.startsWith(':')) {
      if (block === ': ping') heartbeats += 1;
      continue;
    }
    const lines = block.split('\n');
    const event = lines.find((line) => line.startsWith('event: '))?.slice(7) ?? 'message';
    const data = lines
      .filter((line) => line.startsWith('data: '))
      .map((line) => line.slice(6))
      .join('\n');
    events.push({ event, data: JSON.parse(data) as unknown });
  }
  return { events, heartbeats, opened, types: events.map((e) => e.event) };
}

/** Collects every log line the app writes. */
export function captureLogs() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(...String(chunk).split('\n').filter(Boolean));
      done();
    },
  });
  return { lines, logger: { ...loggerOptions(stream), level: 'trace' } };
}
