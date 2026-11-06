import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vitest/config';

// Only the database URLs are taken from .env: the test URL, and the real ones so the test
// setup can refuse to run if they are the same. Nothing else (JWT or Gemini secrets) is loaded.
try {
  const fromFile = parseEnv(readFileSync(new URL('./.env', import.meta.url), 'utf8'));
  for (const name of ['TEST_DATABASE_URL', 'DATABASE_URL', 'MIGRATION_DATABASE_URL'] as const) {
    const value = fromFile[name];
    if (value && !process.env[name]) process.env[name] = value;
  }
} catch {
  // No .env (CI): TEST_DATABASE_URL must come from the environment.
}

export default defineConfig({
  test: {
    globalSetup: ['./src/test/global-setup.ts'],
    // One shared test database, truncated between tests: files must not run in parallel.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
