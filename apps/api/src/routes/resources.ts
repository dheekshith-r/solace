import { resourcesResponseSchema } from '@solace/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { RESOURCES } from '../resources/guides';

/** GET /resources (ticket 12): static guides and help numbers. Public; the app caches it. */
export function registerResourcesRoute(scope: FastifyInstance) {
  scope.withTypeProvider<ZodTypeProvider>().get(
    '/resources',
    { schema: { response: { 200: resourcesResponseSchema } } },
    async (_request, reply) => {
      reply.header('cache-control', 'public, max-age=3600');
      return RESOURCES;
    },
  );
}
