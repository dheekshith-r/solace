import { healthResponseSchema, errorResponseSchema } from '@solace/shared';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('GET /health', () => {
  it('returns ok and pings the database', async () => {
    let pings = 0;
    const app = buildApp({
      pingDb: async () => {
        pings += 1;
      },
    });

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(healthResponseSchema.parse(response.json())).toEqual({ ok: true });
    expect(pings).toBe(1);
  });

  it('returns 503 without leaking details when the database is down', async () => {
    const app = buildApp({
      pingDb: async () => {
        throw new Error('password authentication failed for user secret-user');
      },
    });

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(503);
    expect(errorResponseSchema.parse(response.json()).error.code).toBe('database_unavailable');
    expect(response.body).not.toContain('secret-user');
  });
});
