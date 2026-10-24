import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Database } from './client.js';
import { connect } from './client.js';

const MIGRATIONS = fileURLToPath(new URL('../migrations', import.meta.url));

export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const connection = connect();
  await runMigrations(connection.db);
  await connection.close();
  console.log('migrations applied');
}
