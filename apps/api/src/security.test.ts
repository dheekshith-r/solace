import { authResponseSchema, errorResponseSchema, refreshResponseSchema } from '@solace/shared';
import type { InjectOptions } from 'fastify';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { BODY_LIMIT_BYTES, DEFAULT_RATE_LIMITS, trustProxyHops } from './app';
import { hashRefreshToken } from './auth/tokens';
import { refreshTokens, users } from './db/schema';
import { bearer, captureLogs, PASSWORD, signup, signupBody, useTestDb } from './test/helpers';

const ctx = useTestDb();

describe('rate limits', () => {
  it('the 11th auth call within a minute returns 429', async () => {
    const app = ctx.app({ rateLimits: { auth: DEFAULT_RATE_LIMITS.auth } });
    expect(DEFAULT_RATE_LIMITS.auth).toEqual({ max: 10, timeWindow: 60_000 });

    const statuses: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: `bogus-${i}` },
      });
      statuses.push(response.statusCode);
    }
    expect(statuses).toEqual(Array(10).fill(401));

    // Counted per IP across all auth routes, not per route.
    const eleventh = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'a@example.com', password: PASSWORD },
    });
    expect(eleventh.statusCode).toBe(429);
    expect(errorResponseSchema.parse(eleventh.json()).error.code).toBe('rate_limited');

    const otherIp = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      remoteAddress: '10.0.0.9',
      payload: { refreshToken: 'bogus' },
    });
    expect(otherIp.statusCode).toBe(401);

    // /health is never limited (the keep-warm pinger hits it).
    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);
  });

  it('limits other routes per user, not per IP', async () => {
    const app = ctx.app({
      rateLimits: { auth: { max: 100, timeWindow: 60_000 }, user: { max: 3, timeWindow: 60_000 } },
    });
    const first = await signup(app);
    const second = await signup(app);

    for (let i = 0; i < 3; i += 1) {
      const ok = await app.inject({ method: 'GET', url: '/me', headers: bearer(first.accessToken) });
      expect(ok.statusCode).toBe(200);
    }
    const limited = await app.inject({
      method: 'GET',
      url: '/me/settings',
      headers: bearer(first.accessToken),
    });
    expect(limited.statusCode).toBe(429);
    expect(errorResponseSchema.parse(limited.json()).error.code).toBe('rate_limited');

    // Same IP, different user: not limited.
    const other = await app.inject({ method: 'GET', url: '/me', headers: bearer(second.accessToken) });
    expect(other.statusCode).toBe(200);
  });

  it('with one trusted proxy, spoofed X-Forwarded-For entries share the real client bucket', async () => {
    const app = ctx.app({
      trustProxy: trustProxyHops(1),
      rateLimits: { auth: { max: 1, timeWindow: 60_000 } },
    });
    // Render's proxy (the socket peer) appends the address it saw; anything to the left of that
    // came from the client and must not choose the bucket.
    const fromProxy = (forwardedFor: string) =>
      app.inject({
        method: 'POST',
        url: '/auth/refresh',
        remoteAddress: '10.0.0.1',
        headers: { 'x-forwarded-for': forwardedFor },
        payload: { refreshToken: 'bogus' },
      });

    expect((await fromProxy('6.6.6.6, 203.0.113.7')).statusCode).toBe(401);
    const spoofed = await fromProxy('7.7.7.7, 203.0.113.7');
    expect(spoofed.statusCode).toBe(429);
    expect((await fromProxy('8.8.8.8, 9.9.9.9, 203.0.113.7')).statusCode).toBe(429);

    // A different real client behind the same proxy has its own bucket (not the proxy's address).
    expect((await fromProxy('6.6.6.6, 203.0.113.8')).statusCode).toBe(401);
  });

  it('with no trusted proxy, X-Forwarded-For is ignored entirely', async () => {
    const app = ctx.app({
      trustProxy: trustProxyHops(0),
      rateLimits: { auth: { max: 1, timeWindow: 60_000 } },
    });
    const direct = (forwardedFor: string) =>
      app.inject({
        method: 'POST',
        url: '/auth/refresh',
        remoteAddress: '198.51.100.4',
        headers: { 'x-forwarded-for': forwardedFor },
        payload: { refreshToken: 'bogus' },
      });

    expect((await direct('1.1.1.1')).statusCode).toBe(401);
    expect((await direct('2.2.2.2')).statusCode).toBe(429);
  });

  it('defaults to 120 per minute per user', () => {
    expect(DEFAULT_RATE_LIMITS.user).toEqual({ max: 120, timeWindow: 60_000 });
  });
});

describe('secrets never leak', () => {
  it('no response or log line contains a password, hash or token secret', async () => {
    const { lines, logger } = captureLogs();
    const app = ctx.app({ logger });
    const responses: string[] = [];
    const call = async (options: InjectOptions) => {
      const response = await app.inject(options);
      responses.push(response.body);
      return response;
    };

    const body = signupBody({ email: 'leak@example.com' });
    const signupResponse = await call({ method: 'POST', url: '/auth/signup', payload: body });
    const session = authResponseSchema.parse(signupResponse.json());

    await call({ method: 'POST', url: '/auth/signup', payload: body }); // 409
    await call({ method: 'POST', url: '/auth/signup', payload: { ...body, password: 'short' } });
    await call({
      method: 'POST',
      url: '/auth/signup',
      headers: { 'content-type': 'application/json' },
      payload: `{"email":"x@example.com","password":"${PASSWORD}"`, // malformed JSON
    });
    await call({
      method: 'POST',
      url: '/auth/login',
      payload: { email: body.email, password: `${PASSWORD}-wrong` },
    });
    const login = await call({
      method: 'POST',
      url: '/auth/login',
      payload: { email: body.email, password: PASSWORD },
    });
    const loginSession = authResponseSchema.parse(login.json());
    const refreshed = refreshResponseSchema.parse(
      (
        await call({
          method: 'POST',
          url: '/auth/refresh',
          payload: { refreshToken: session.refreshToken },
        })
      ).json(),
    );
    await call({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: session.refreshToken },
    }); // reuse
    await call({ method: 'GET', url: '/me', headers: bearer(loginSession.accessToken) });
    await call({ method: 'GET', url: '/me', headers: bearer(`${loginSession.accessToken}x`) });
    await call({
      method: 'PATCH',
      url: '/me',
      headers: bearer(loginSession.accessToken),
      payload: { password: PASSWORD },
    });
    await call({
      method: 'POST',
      url: '/auth/logout',
      payload: { refreshToken: loginSession.refreshToken },
    });

    const [row] = await ctx.db.select().from(users).where(eq(users.email, body.email));
    const tokenHashes = (await ctx.db.select().from(refreshTokens)).map((r) => r.tokenHash);
    expect(row).toBeDefined();
    expect(tokenHashes.length).toBeGreaterThanOrEqual(3);
    expect(tokenHashes).toContain(hashRefreshToken(refreshed.refreshToken));

    const secretsInResponses = [PASSWORD, row!.passwordHash, ctx.jwtSecret, ...tokenHashes];
    const secretsInLogs = [
      ...secretsInResponses,
      session.accessToken,
      session.refreshToken,
      loginSession.accessToken,
      loginSession.refreshToken,
      refreshed.accessToken,
      refreshed.refreshToken,
    ];

    expect(lines.length).toBeGreaterThan(10);
    for (const line of lines) {
      for (const secret of secretsInLogs) expect(line).not.toContain(secret);
      expect(line).not.toMatch(/\$argon2/);
    }
    for (const response of responses) {
      for (const secret of secretsInResponses) expect(response).not.toContain(secret);
      expect(response).not.toMatch(/passwordHash|password_hash|\$argon2/);
    }
  });

  it('sets helmet security headers', async () => {
    const response = await ctx.app().inject({ method: 'GET', url: '/health' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('rejects bodies over the 32 KB limit with 413', async () => {
    expect(BODY_LIMIT_BYTES).toBe(32 * 1024);
    const response = await ctx.app().inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { ...signupBody(), name: 'x'.repeat(BODY_LIMIT_BYTES) },
    });
    expect(response.statusCode).toBe(413);
    expect(errorResponseSchema.parse(response.json()).error.code).toBe('payload_too_large');
  });

  it('unknown routes return the error shape', async () => {
    const response = await ctx.app().inject({ method: 'GET', url: '/nope' });
    expect(response.statusCode).toBe(404);
    expect(errorResponseSchema.parse(response.json()).error.code).toBe('not_found');
  });
});
