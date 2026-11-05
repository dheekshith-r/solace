import { healthResponseSchema, type HealthResponse } from '@solace/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const REQUEST_TIMEOUT_MS = 5_000; // Show failures fast. Waking Render is handled by background retries.

export async function fetchHealth(): Promise<HealthResponse> {
  if (!API_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not set');
  }

  const response = await fetch(`${API_URL}/health`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Health check returned ${response.status}`);
  }
  return healthResponseSchema.parse(await response.json());
}
