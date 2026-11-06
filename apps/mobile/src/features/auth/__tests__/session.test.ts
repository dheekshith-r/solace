import { ApiError, request, withQuietRetry } from '../../../lib/http';
import { signUpErrors } from '../AuthForms';

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

  it('is exported for screens', () => {
    expect(typeof request).toBe('function');
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
