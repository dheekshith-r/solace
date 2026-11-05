import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export function createDb(databaseUrl: string) {
  // prepare: false is required by the Supabase transaction pooler.
  const connection = postgres(databaseUrl, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  const db = drizzle(connection, { schema });

  return {
    db,
    ping: async () => {
      await db.execute(sql`select 1`);
    },
    close: () => connection.end({ timeout: 5 }),
  };
}

export type Database = ReturnType<typeof createDb>['db'];
