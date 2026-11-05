import type { ErrorResponse, HealthResponse } from '@solace/shared';
import type { FastifyInstance } from 'fastify';

export function registerHealthRoute(app: FastifyInstance, pingDb: () => Promise<void>) {
  // Also the keep-warm target: touching the database keeps Supabase from pausing the project.
  app.get('/health', async (request, reply): Promise<HealthResponse | ErrorResponse> => {
    try {
      await pingDb();
      return { ok: true };
    } catch (error) {
      request.log.error({ err: error }, 'health check: database unreachable');
      reply.code(503);
      return { error: { code: 'database_unavailable', message: 'Database is unreachable.' } };
    }
  });
}
