import { fileURLToPath } from 'node:url';
import { sampleLesson } from '@lcg/lesson-schema/testing';
import { sql } from 'drizzle-orm';
import { connect, type Database } from './client.js';
import { replaceLessonContent } from './documents.js';
import { runMigrations } from './migrate.js';
import { users } from './schema.js';
import { importSampleUnit, setLessonStatus } from './testing.js';

/** The demo accounts described in docs/users.md. */
export const DEMO_USERS = [
  { name: 'Maya Chen', role: 'editor' },
  { name: 'Jordan Ellis', role: 'editor' },
  { name: 'Sam Rivera', role: 'editor' },
  { name: 'Priya Natarajan', role: 'approver' },
  { name: 'Alex Kim', role: 'approver' },
] as const;

/** Loads the demo: users, the sample Unit 4, and Lesson 3 as a hand-written Draft. */
export async function seedDemo(db: Database): Promise<void> {
  const seeded = await db.insert(users).values([...DEMO_USERS]).returning({ id: users.id });
  const unitId = await importSampleUnit(db, seeded[0]!.id);
  const lessonId = await setLessonStatus(db, unitId, 'L3', 'draft');
  await replaceLessonContent(db, lessonId, sampleLesson());
}

/** Drops everything, migrates and seeds (pnpm db:reset). */
async function reset(): Promise<void> {
  const connection = connect();
  await connection.db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;`);
  await runMigrations(connection.db);
  await seedDemo(connection.db);
  await connection.close();
  console.log('database reset and seeded');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await reset();
