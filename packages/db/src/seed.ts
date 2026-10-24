import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { connect } from './client.js';
import { seedDemo } from './demo.js';
import { runMigrations } from './migrate.js';

/** Drops everything, migrates and seeds the demo (pnpm db:reset). */
async function reset(): Promise<void> {
  const connection = connect();
  await connection.db.execute(
    sql`DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;`,
  );
  await runMigrations(connection.db);
  await seedDemo(connection.db);
  await connection.close();
  console.log('database reset and seeded');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await reset();
