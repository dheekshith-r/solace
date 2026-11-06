import type { FastifyInstance, FastifyRequest } from 'fastify';
import { unauthorized } from '../lib/errors';
import type { TokenService } from './tokens';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the auth guard on protected routes. */
    userId: string;
  }
}

/**
 * Auth guard: every route registered in this scope after the call requires
 * `Authorization: Bearer <access token>`. Runs on onRequest, before body parsing.
 */
export function requireAuth(scope: FastifyInstance, tokens: TokenService) {
  scope.decorateRequest('userId', '');
  scope.addHook('onRequest', async (request: FastifyRequest) => {
    const header = request.headers.authorization;
    const match = header ? /^Bearer ([A-Za-z0-9_.-]+)$/.exec(header) : null;
    if (!match?.[1]) throw unauthorized();
    const userId = await tokens.verifyAccessToken(match[1]);
    if (!userId) throw unauthorized();
    request.userId = userId;
  });
}
