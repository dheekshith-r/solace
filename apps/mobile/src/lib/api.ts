import { healthResponseSchema, type HealthResponse } from '@solace/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const HEALTH_TIMEOUT_MS = 90_000; // Render's free tier can take about a minute to wake.

export async function fetchHealth(): Promise<HealthResponse> {
  if (!API_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not set');
  }

  const response = await fetch(`${API_URL}/health`, {
    signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Health check returned ${response.status}`);
  }
  return healthResponseSchema.parse(await response.json());
}
