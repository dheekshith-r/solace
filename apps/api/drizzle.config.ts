import { defineConfig } from 'drizzle-kit';

try {
  process.loadEnvFile('.env');
} catch {
  // No local .env: `db:generate` needs no database, and `db:migrate` reports the missing URL.
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  // Migrations use the session pooler (port 5432). The app uses the transaction pooler (6543).
  dbCredentials: { url: process.env.MIGRATION_DATABASE_URL ?? '' },
});
