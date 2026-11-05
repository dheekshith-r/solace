import Fastify from 'fastify';
import { registerHealthRoute } from './routes/health';

export type AppDeps = {
  pingDb: () => Promise<void>;
  logger?: boolean;
};

export function buildApp({ pingDb, logger = false }: AppDeps) {
  const app = Fastify({ logger });
  registerHealthRoute(app, pingDb);
  return app;
}
