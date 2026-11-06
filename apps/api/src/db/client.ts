import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export function createDb(databaseUrl: string) {
  // prepare: false is required by the Supabase transaction pooler.
  // max_pipeline: 1 because postgres.js 4 otherwise pipelines queries onto busy connections when
  // the pool is saturated, and those queries never complete through the transaction pooler
  // (measured: 4 concurrent queries on a pool of 3 hang forever). Queries now wait for a free one.
  const connection = postgres(databaseUrl, {
    prepare: false,
    max_pipeline: 1,
    // Seconds a query may wait for a free connection before failing, instead of hanging a request.
    queue_timeout: 10,
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
