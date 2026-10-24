import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

export type Database = NodePgDatabase<typeof schema>;
/** A database handle or an open transaction; repositories accept either. */
export type Executor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

export interface Connection {
  db: Database;
  pool: pg.Pool;
  close(): Promise<void>;
}

export function connect(url = process.env.DATABASE_URL): Connection {
  if (!url) throw new Error('DATABASE_URL is not set');
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  const db = drizzle(pool, { schema });
  return { db, pool, close: () => pool.end() };
}
