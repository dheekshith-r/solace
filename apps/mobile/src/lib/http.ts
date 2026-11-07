import { errorResponseSchema } from '@solace/shared';
import type { z } from 'zod';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

/** Show failures fast (spec 8): a request that hasn't answered in 4 s is reported, then retried quietly. */
export const REQUEST_TIMEOUT_MS = 4_000;
/** Render's free tier can take about a minute to wake, so quiet retries continue that long. */
export const RETRY_WINDOW_MS = 60_000;
const RETRY_DELAYS_MS = [1_500, 3_000, 6_000, 10_000];
/**
 * Sign-up and log-in wait this long for one answer, so a Render cold start (up to about a minute)
 * never looks like a failure. All other requests keep the short timeout.
 */
export const AUTH_TIMEOUT_MS = 60_000;
/** After this long without an answer, sign-up and log-in say Sola is waking up. */
export const WAKING_HINT_MS = 3_000;

export type ApiErrorKind = 'offline' | 'http';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status = 0,
    readonly code = kind === 'offline' ? 'offline' : 'unknown',
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Worth trying again later: no answer, or the server (or its proxy) is still waking up. */
  get retryable(): boolean {
    return this.kind === 'offline' || this.status === 502 || this.status === 503 || this.status === 504;
  }
}

export const OFFLINE_MESSAGE = "Couldn't reach Solace. Check your connection and try again.";

type RequestOptions<T> = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  schema?: z.ZodType<T>;
  timeoutMs?: number;
};

/** One JSON request. Throws ApiError: `offline` for no answer in time, `http` with the server's code otherwise. */
export async function request<T = void>(path: string, { method = 'GET', body, token, schema, timeoutMs = REQUEST_TIMEOUT_MS }: RequestOptions<T> = {}): Promise<T> {
  if (!API_URL) throw new ApiError('offline', 'EXPO_PUBLIC_API_URL is not set');
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : null),
        ...(token ? { Authorization: `Bearer ${token}` } : null),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new ApiError('offline', OFFLINE_MESSAGE);
  }
  if (!response.ok) {
    const parsed = errorResponseSchema.safeParse(await response.json().catch(() => null));
    const fallback = response.status >= 500 ? OFFLINE_MESSAGE : 'Something went wrong. Please try again.';
    throw new ApiError('http', parsed.success ? parsed.data.error.message : fallback, response.status, parsed.success ? parsed.data.error.code : 'unknown');
  }
  if (response.status === 204 || !schema) return undefined as T;
  return schema.parse(await response.json());
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `attempt`, and if it fails in a retryable way, tells the caller (so it can say "still trying")
 * and retries quietly with backoff for up to a minute. Non-retryable errors are thrown straight away.
 */
export async function withQuietRetry<T>(
  attempt: () => Promise<T>,
  onRetrying?: (error: ApiError) => void,
  windowMs = RETRY_WINDOW_MS,
  shouldRetry: (error: ApiError) => boolean = (error) => error.retryable,
): Promise<T> {
  const started = Date.now();
  for (let i = 0; ; i += 1) {
    try {
      return await attempt();
    } catch (error) {
      if (!(error instanceof ApiError) || !shouldRetry(error) || Date.now() - started > windowMs) throw error;
      onRetrying?.(error);
      await wait(RETRY_DELAYS_MS[Math.min(i, RETRY_DELAYS_MS.length - 1)] ?? 0);
    }
  }
}

/**
 * Render's proxy answered for a server that is still starting, so the request never reached the
 * API. Only these are safe to resend for sign-up: after a timeout the account may already exist,
 * and a resend would wrongly report "an account with this email already exists".
 */
export const neverReachedServer = (error: ApiError) => error.kind === 'http' && (error.status === 502 || error.status === 503 || error.status === 504);

/**
 * Sign-up and log-in: one long attempt (AUTH_TIMEOUT_MS), resent only if the server was never
 * reached. `onWaking` fires once if there's no answer after WAKING_HINT_MS.
 */
export async function authAttempt<T>(attempt: () => Promise<T>, onWaking: () => void): Promise<T> {
  const hint = setTimeout(onWaking, WAKING_HINT_MS);
  try {
    return await withQuietRetry(attempt, onWaking, RETRY_WINDOW_MS, neverReachedServer);
  } finally {
    clearTimeout(hint);
  }
}
