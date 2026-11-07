import type { ErrorResponse, HealthResponse } from '@solace/shared';
import type { AiStats } from '../lib/ai-stats';
import type { FastifyInstance } from 'fastify';

export function registerHealthRoute(app: FastifyInstance, pingDb: () => Promise<void>) {
  // Also the keep-warm target: touching the database keeps Supabase from pausing the project.
  app.get('/health', async (request, reply): Promise<HealthResponse | ErrorResponse> => {
    try {
      await pingDb();
      return { ok: true };
    } catch (error) {
      // Name and code only: driver errors carry the query and its parameters.
      const errName = error instanceof Error ? error.name : 'unknown';
      const causeCode = (error as { cause?: { code?: string } }).cause?.code ?? (error as { code?: string }).code;
      request.log.error({ errName, causeCode }, 'health check: database unreachable');
      reply.code(503);
      return { error: { code: 'database_unavailable', message: 'Database is unreachable.' } };
    }
  });
}

/**
 * Reply-model counts since the process started: { replies, primary503, fallbacks }.
 * Public by design: totals only, nothing per user and no content.
 */
export function registerAiHealthRoute(app: FastifyInstance, stats: AiStats) {
  app.get('/health/ai', async (_request, reply) => {
    reply.header('cache-control', 'no-store');
    return stats.snapshot();
  });
}
