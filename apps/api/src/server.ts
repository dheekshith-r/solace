import { buildApp } from './app';
import { createDb } from './db/client';
import { loadEnv } from './env';

const env = loadEnv();
const database = createDb(env.DATABASE_URL);
const app = buildApp({ pingDb: database.ping, logger: true });

async function shutdown() {
  await app.close();
  await database.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ host: '0.0.0.0', port: env.PORT });
