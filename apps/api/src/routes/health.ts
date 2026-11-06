import type { ErrorResponse, HealthResponse } from '@solace/shared';
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
