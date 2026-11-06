import { buildApp, loggerOptions, trustProxyHops } from './app';
import { createDb } from './db/client';
import { loadEnv } from './env';

const env = loadEnv();
const database = createDb(env.DATABASE_URL);
const app = buildApp({
  pingDb: database.ping,
  db: database.db,
  jwtSecret: env.JWT_SECRET,
  logger: loggerOptions(),
  // A fixed hop count, not `true`: only the addresses added by Render's sidecar, load balancer and Cloudflare are trusted, so a
  // client cannot pick its own IP (and rate-limit bucket) by sending X-Forwarded-For.
  trustProxy: trustProxyHops(env.TRUST_PROXY_HOPS),
});

async function shutdown() {
  await app.close();
  await database.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ host: '0.0.0.0', port: env.PORT });
