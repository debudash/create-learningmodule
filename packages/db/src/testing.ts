import pg from 'pg';
import { connect, type Connection } from './client.js';
import { runMigrations } from './migrate.js';
import { users } from './schema.js';

const TEST_URL = process.env.DATABASE_URL_TEST ?? 'postgres://lcg:lcg@localhost:5432/lcg_test';

/**
 * For integration tests: an empty, fully migrated test database with one Editor
 * and one Approver. Creates the database on first use.
 */
export async function freshDatabase(): Promise<
  Connection & { editorId: string; approverId: string }
> {
  await ensureDatabaseExists(TEST_URL);
  const connection = connect(TEST_URL);
  await connection.pool.query('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;');
  await runMigrations(connection.db);
  const [editor, approver] = await connection.db
    .insert(users)
    .values([
      { name: 'Test Editor', role: 'editor' },
      { name: 'Test Approver', role: 'approver' },
    ])
    .returning({ id: users.id });
  return { ...connection, editorId: editor!.id, approverId: approver!.id };
}

async function ensureDatabaseExists(url: string): Promise<void> {
  const target = new URL(url);
  const name = target.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (exists.rowCount === 0) await client.query(`CREATE DATABASE "${name.replace(/"/g, '')}"`);
  } finally {
    await client.end();
  }
}
