import { count } from 'drizzle-orm';
import { connect } from './client.js';
import { seedDemo } from './demo.js';
import { runMigrations } from './migrate.js';
import { users } from './schema.js';

/**
 * Brings a database up to date and seeds the demo the first time (the Compose
 * `setup` service). Unlike db:reset it never drops data, so it runs on every start.
 */
const connection = connect();
await runMigrations(connection.db);
const [people] = await connection.db.select({ n: count() }).from(users);
if ((people?.n ?? 0) === 0) {
  await seedDemo(connection.db);
  console.log('migrations applied; demo seeded');
} else {
  console.log('migrations applied; existing data kept');
}
await connection.close();
