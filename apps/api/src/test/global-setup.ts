import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { testDatabaseUrl } from './database';

/** Brings the test database up to the latest migration once, before any test file runs. */
export default async function setup() {
  const connection = postgres(testDatabaseUrl(), {
    prepare: false,
    max: 1,
    onnotice: () => {},
  });
  try {
    await migrate(drizzle(connection), {
      migrationsFolder: fileURLToPath(new URL('../db/migrations', import.meta.url)),
    });
  } finally {
    await connection.end({ timeout: 5 });
  }
}
