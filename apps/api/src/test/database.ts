/** Host, user and database name: what makes two URLs the same database, whatever the port. */
function databaseIdentity(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname.toLowerCase(),
    user: decodeURIComponent(parsed.username),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, '')) || 'postgres',
  };
}

/** The test database URL. Throws rather than ever falling back to the real database. */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set (apps/api/.env or the environment).');
  }

  let test: ReturnType<typeof databaseIdentity>;
  try {
    test = databaseIdentity(url);
  } catch {
    // Never echo the URL: it holds the password.
    throw new Error('TEST_DATABASE_URL is not a valid URL.');
  }

  // Supabase identifies a project by the username (postgres.<project-ref>) on a shared pooler host,
  // and the session (5432) and transaction (6543) poolers differ only by port: compare without it.
  for (const name of ['DATABASE_URL', 'MIGRATION_DATABASE_URL'] as const) {
    const other = process.env[name];
    if (!other) continue;
    let real: ReturnType<typeof databaseIdentity>;
    try {
      real = databaseIdentity(other);
    } catch {
      continue;
    }
    if (real.host === test.host && real.user === test.user && real.database === test.database) {
      throw new Error(`TEST_DATABASE_URL points at the same database as ${name}. Refusing to run.`);
    }
  }
  return url;
}
