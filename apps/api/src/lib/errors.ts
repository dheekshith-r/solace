import type { ErrorResponse } from '@solace/shared';
import type { FastifyError, FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';

/** An error whose code and message are safe to show to the client. */
export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const unauthorized = (message = 'Sign in again to continue.') =>
  new ApiError(401, 'unauthorized', message);

const GENERIC_CLIENT_ERRORS: Record<number, [string, string]> = {
  400: ['bad_request', 'The request could not be read.'],
  401: ['unauthorized', 'Sign in again to continue.'],
  403: ['forbidden', 'You cannot do that.'],
  404: ['not_found', 'Not found.'],
  405: ['method_not_allowed', 'Method not allowed.'],
  406: ['not_acceptable', 'Not acceptable.'],
  413: ['payload_too_large', 'The request is too large.'],
  415: ['unsupported_media_type', 'Send JSON with Content-Type: application/json.'],
};

const body = (code: string, message: string): ErrorResponse => ({ error: { code, message } });

/**
 * Every error leaves the API as { error: { code, message } }.
 * Logs carry only the error class and code: messages of database errors can include query
 * parameters (password hashes, token hashes), so they are never logged or returned.
 */
export function registerErrorHandling(app: FastifyInstance) {
  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send(body('not_found', 'Not found.'));
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send(body(error.code, error.message));
    }

    if (hasZodFastifySchemaValidationErrors(error) || error.validation) {
      const first = error.validation?.[0];
      const field = first?.instancePath?.replace(/^\//, '').replaceAll('/', '.');
      const detail = first?.message ?? 'Invalid request.';
      const message = field ? `${field}: ${detail}` : detail;
      return reply.code(400).send(body('invalid_request', message));
    }

    const status = error.statusCode ?? 500;
    if (status === 429) {
      return reply
        .code(429)
        .send(body('rate_limited', 'Too many requests. Wait a minute and try again.'));
    }

    if (status >= 400 && status < 500) {
      const [code, message] = GENERIC_CLIENT_ERRORS[status] ?? ['bad_request', 'Bad request.'];
      request.log.info({ errCode: error.code, status }, 'client error');
      return reply.code(status).send(body(code, message));
    }

    const cause = error.cause as { code?: unknown } | undefined;
    request.log.error(
      { errName: error.name, errCode: error.code, causeCode: cause?.code },
      'unhandled error',
    );
    return reply.code(500).send(body('internal_error', 'Something went wrong. Try again.'));
  });
}
