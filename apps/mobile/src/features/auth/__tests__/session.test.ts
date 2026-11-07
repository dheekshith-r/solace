import { ApiError, request, withQuietRetry } from '../../../lib/http';
import { signUpErrors } from '../AuthForms';
import { needsSignIn, safeNext } from '../AuthGate';

const secure: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => secure[k] ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    secure[k] = v;
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    delete secure[k];
  }),
}));
jest.mock('react-native-mmkv', () => {
  const data = new Map<string, string>();
  return {
    createMMKV: () => ({
      getString: (k: string) => data.get(k),
      set: (k: string, v: string) => data.set(k, v),
      remove: (k: string) => data.delete(k),
      clearAll: () => data.clear(),
    }),
  };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }), useFocusEffect: jest.fn() }));

const user = { id: 'u1', email: 'a@b.co', name: 'A', goal: null, personalize: true, timezone: 'UTC', createdAt: '2026-11-06T00:00:00Z' };
const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as unknown as Response;

let fetchMock: jest.Mock;
beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
  fetchMock = jest.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  for (const k of Object.keys(secure)) delete secure[k];
  jest.resetModules();
});

// The modules read EXPO_PUBLIC_API_URL when they load, so they're loaded fresh after it is set.
/* eslint-disable @typescript-eslint/no-require-imports */
function freshSession() {
  return require('../session') as typeof import('../session');
}
function freshHttp() {
  return require('../../../lib/http') as typeof import('../../../lib/http');
}
/* eslint-enable @typescript-eslint/no-require-imports */

describe('authed requests', () => {
  it('refreshes once on a 401 and retries the original request', async () => {
    const { authed, useSession } = freshSession();
    secure['solace.refresh'] = 'r1';
    useSession.setState({ accessToken: 'old' });
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: 'unauthorized', message: 'Expired.' } }))
      .mockResolvedValueOnce(json(200, { accessToken: 'new', refreshToken: 'r2' }))
      .mockResolvedValueOnce(json(200, { user, stats: { xp: 0, level: 1, streak: 0, xpToNext: 100 } }));
    await authed('/me');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer new');
    expect(secure['solace.refresh']).toBe('r2');
  });

  it('shares one refresh between parallel 401s', async () => {
    const { refreshSession } = freshSession();
    secure['solace.refresh'] = 'r1';
    fetchMock.mockResolvedValue(json(200, { accessToken: 'new', refreshToken: 'r2' }));
    const [a, b] = await Promise.all([refreshSession(), refreshSession()]);
    expect(a).toBe('new');
    expect(b).toBe('new');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('signs out when the refresh token is rejected', async () => {
    const { refreshSession, useSession } = freshSession();
    secure['solace.refresh'] = 'stale';
    useSession.setState({ user, accessToken: 'old' });
    fetchMock.mockResolvedValue(json(401, { error: { code: 'invalid_refresh', message: 'Signed out.' } }));
    await expect(refreshSession()).rejects.toBeInstanceOf(Error);
    expect(secure['solace.refresh']).toBeUndefined();
    expect(useSession.getState().user).toBeNull();
  });
});

describe('http', () => {
  it('reports no answer as an offline error', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'));
    const { request: fresh, ApiError: FreshError } = freshHttp();
    const error = await fresh('/health').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FreshError);
    expect((error as InstanceType<typeof FreshError>).kind).toBe('offline');
  });

  it('retries quietly while offline, then succeeds', async () => {
    jest.useFakeTimers();
    let calls = 0;
    const onRetrying = jest.fn();
    const done = withQuietRetry(async () => {
      calls += 1;
      if (calls < 3) throw new ApiError('offline', 'no');
      return 'ok';
    }, onRetrying);
    await jest.advanceTimersByTimeAsync(20_000);
    await expect(done).resolves.toBe('ok');
    expect(onRetrying).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('does not retry a request the server rejected', async () => {
    const attempt = jest.fn(async () => {
      throw new ApiError('http', 'Taken.', 409, 'email_taken');
    });
    await expect(withQuietRetry(attempt)).rejects.toMatchObject({ status: 409 });
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('sign-up and log-in wait up to 60 s for one answer; other requests keep the short timeout', async () => {
    const timeout = jest.spyOn(AbortSignal, 'timeout');
    const { signUp, logIn } = freshSession();
    const { request: fresh } = freshHttp();
    const ok = { user, accessToken: 'a', refreshToken: 'r' };
    fetchMock.mockResolvedValue(json(201, ok));
    await signUp({ name: 'A', email: 'a@b.co', password: 'longenough', isAdult: true });
    await logIn({ email: 'a@b.co', password: 'longenough' });
    fetchMock.mockResolvedValue(json(200, {}));
    await fresh('/health');
    expect(timeout.mock.calls.map(([ms]) => ms)).toEqual([60_000, 60_000, 4_000]);
    timeout.mockRestore();
  });

  it('auth: says "waking" after 3 s, and never resends after a timeout (the account may already exist)', async () => {
    jest.useFakeTimers();
    const { authAttempt, ApiError: FreshError } = freshHttp();
    const onWaking = jest.fn();
    const attempt = jest.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      throw new FreshError('offline', 'no answer');
    });
    const done = authAttempt(attempt, onWaking).catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(2_900);
    expect(onWaking).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(200);
    expect(onWaking).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(await done).toMatchObject({ kind: 'offline' });
    expect(attempt).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('auth: resends only when Render’s proxy says the server was never reached', async () => {
    jest.useFakeTimers();
    const { authAttempt, ApiError: FreshError } = freshHttp();
    let calls = 0;
    const done = authAttempt(async () => {
      calls += 1;
      if (calls === 1) throw new FreshError('http', 'waking', 503);
      return 'ok';
    }, jest.fn());
    await jest.advanceTimersByTimeAsync(5_000);
    await expect(done).resolves.toBe('ok');
    expect(calls).toBe(2);
    jest.useRealTimers();
  });

  it('is exported for screens', () => {
    expect(typeof request).toBe('function');
  });
});

describe('links while signed out', () => {
  it('signed-in screens need an account; onboarding, sign-up, log-in and the launch screen do not', () => {
    expect(needsSignIn('/today', false)).toBe(true);
    expect(needsSignIn('/breathe', false)).toBe(true);
    expect(needsSignIn('/today', true)).toBe(false);
    for (const open of ['/', '/onboarding', '/sign-up', '/log-in']) expect(needsSignIn(open, false)).toBe(false);
  });

  it('after log-in, only an in-app screen that needs an account is opened', () => {
    expect(safeNext('/breathe')).toBe('/breathe');
    expect(safeNext('//evil.example')).toBeNull();
    expect(safeNext('https://evil.example')).toBeNull();
    expect(safeNext('/log-in')).toBeNull();
    expect(safeNext(undefined)).toBeNull();
  });
});

describe('sign-up validation', () => {
  it('explains each missing piece', () => {
    const errors = signUpErrors({ name: ' ', email: 'nope', password: 'short', adult: false });
    expect(errors.name).toBe('Tell Sola what to call you.');
    expect(errors.email).toContain('name@example.com');
    expect(errors.password).toBe('Use 8 or more characters.');
    expect(errors.adult).toBe('You must be 18 or older to use Solace.');
  });

  it('passes a complete form', () => {
    expect(Object.values(signUpErrors({ name: 'Ddk', email: 'ddk@example.com', password: 'longenough', adult: true })).some(Boolean)).toBe(false);
  });
});
