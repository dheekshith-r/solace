import {
  authResponseSchema,
  meResponseSchema,
  refreshResponseSchema,
  type AuthResponse,
  type LoginRequest,
  type SignupRequest,
  type User,
} from '@solace/shared';
import { cancelAllScheduledNotificationsAsync } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ApiError, request } from '../../lib/http';
import { queryClient } from '../../lib/queryClient';
import { storage, zustandStorage } from '../../lib/storage';
import { useOnboarding } from '../onboarding/store';

const REFRESH_KEY = 'solace.refresh';

type SessionState = {
  user: User | null;
  /** In memory only; never persisted. */
  accessToken: string | null;
  setUser: (user: User | null) => void;
  setAccess: (token: string | null) => void;
};

/** Who is signed in. The user profile is cached so Today can open offline; tokens are not in MMKV. */
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setUser: (user) => set({ user }),
      setAccess: (accessToken) => set({ accessToken }),
    }),
    { name: 'session', storage: createJSONStorage(() => zustandStorage), partialize: (s) => ({ user: s.user }) },
  ),
);

async function begin(result: AuthResponse) {
  await SecureStore.setItemAsync(REFRESH_KEY, result.refreshToken);
  useSession.setState({ user: result.user, accessToken: result.accessToken });
}

export function hasStoredSession(): Promise<boolean> {
  return SecureStore.getItemAsync(REFRESH_KEY).then(Boolean);
}

export async function signUp(body: SignupRequest): Promise<void> {
  await begin(await request('/auth/signup', { method: 'POST', body, schema: authResponseSchema }));
}

export async function logIn(body: LoginRequest): Promise<void> {
  await begin(await request('/auth/login', { method: 'POST', body, schema: authResponseSchema }));
}

let inFlight: Promise<string> | null = null;

/**
 * Swaps the stored refresh token for a new pair. Single-flight: parallel callers share one request, so
 * rotation never races itself. A rejected token (401) ends the session.
 */
export function refreshSession(): Promise<string> {
  inFlight ??= (async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
      if (!refreshToken) throw new ApiError('http', 'Signed out.', 401, 'no_session');
      const pair = await request('/auth/refresh', { method: 'POST', body: { refreshToken }, schema: refreshResponseSchema });
      await SecureStore.setItemAsync(REFRESH_KEY, pair.refreshToken);
      useSession.setState({ accessToken: pair.accessToken });
      return pair.accessToken;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) await clearLocal();
      throw error;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** A request as the signed-in user. On a 401 it refreshes once and retries the original request once. */
export async function authed<T = void>(path: string, options: Omit<Parameters<typeof request<T>>[1] & object, 'token'> = {}): Promise<T> {
  const token = useSession.getState().accessToken ?? (await refreshSession());
  try {
    return await request<T>(path, { ...options, token });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    return request<T>(path, { ...options, token: await refreshSession() });
  }
}

/** Refreshes the cached profile; used after launch, once the session is restored. */
export async function loadMe(): Promise<void> {
  const me = await authed('/me', { schema: meResponseSchema });
  useSession.setState({ user: me.user });
}

/** Everything on the phone about this user goes: tokens, MMKV and in-memory stores. */
async function clearLocal() {
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  await cancelAllScheduledNotificationsAsync().catch(() => undefined);
  storage.clearAll();
  queryClient.clear();
  useSession.setState({ user: null, accessToken: null });
  useOnboarding.getState().reset();
}

/** Revokes the session on the server (best effort; offline still signs out locally), then clears the phone. */
export async function logOut(): Promise<void> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (refreshToken) await request('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => undefined);
  await clearLocal();
}
