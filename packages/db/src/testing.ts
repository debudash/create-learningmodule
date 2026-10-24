import { randomBytes } from 'node:crypto';
import {
  confirmImport,
  parseOutlineCsv,
  type ConfirmedImport,
  type Resolution,
} from '@lcg/outline';
import { sampleOutlineCsv } from '@lcg/outline/testing';
import type { LessonStatus } from '@lcg/domain';
import { and, eq } from 'drizzle-orm';
import pg from 'pg';
import { connect, type Connection } from './client.js';
import { runMigrations } from './migrate.js';
import { lessons, users } from './schema.js';
import { importUnit } from './units.js';

/** The Postgres server integration tests run against (the Compose service by default). */
const SERVER_URL = process.env.DATABASE_URL_TEST ?? 'postgres://lcg:lcg@localhost:5432/postgres';

export type TestDatabase = Connection & { editorId: string; approverId: string };

/**
 * For integration tests: a new, fully migrated database of its own, with one
 * Editor and one Approver. Each call gets a separate database, so test files can
 * run in parallel; close() drops it.
 */
export async function freshDatabase(): Promise<TestDatabase> {
  const name = `lcg_test_${randomBytes(6).toString('hex')}`;
  await admin((client) => client.query(`CREATE DATABASE ${name}`));

  const url = new URL(SERVER_URL);
  url.pathname = `/${name}`;
  const connection = connect(url.toString());
  await runMigrations(connection.db);
  const [editor, approver] = await connection.db
    .insert(users)
    .values([
      { name: 'Test Editor', role: 'editor' },
      { name: 'Test Approver', role: 'approver' },
    ])
    .returning({ id: users.id });

  return {
    ...connection,
    editorId: editor!.id,
    approverId: approver!.id,
    async close() {
      await connection.close();
      await admin((client) => client.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`));
    },
  };
}

async function admin(run: (client: pg.Client) => Promise<unknown>): Promise<void> {
  const client = new pg.Client({ connectionString: SERVER_URL });
  await client.connect();
  try {
    await run(client);
  } finally {
    await client.end();
  }
}

/** The sample Outline with every Blocking issue resolved by its suggestion. */
export function confirmedSampleOutline(): ConfirmedImport {
  const proposal = parseOutlineCsv(sampleOutlineCsv());
  const resolutions: Resolution[] = proposal.issues
    .filter((i) => i.severity === 'blocking')
    .map((i) => ({ issueId: i.id, action: 'accept-suggestion' }));
  const result = confirmImport(proposal, resolutions);
  if (!result.ok) throw new Error(`sample Outline did not confirm: ${result.errors.join('; ')}`);
  return result.confirmed;
}

/** Imports the sample Unit and returns its id. */
export function importSampleUnit(db: Connection['db'], actorId: string): Promise<string> {
  return importUnit(db, {
    confirmed: confirmedSampleOutline(),
    source: { kind: 'file', reference: 'g6-u4-lightning-thief.csv' },
    actorId,
    guidance: 'Default guidance',
  });
}

/** Puts one of a Unit's Lessons into a status and returns the Lesson's id. */
export async function setLessonStatus(
  db: Connection['db'],
  unitId: string,
  key: string,
  status: LessonStatus,
): Promise<string> {
  const [row] = await db
    .update(lessons)
    .set({ status })
    .where(and(eq(lessons.unitId, unitId), eq(lessons.key, key)))
    .returning({ id: lessons.id });
  if (!row) throw new Error(`no Lesson ${key} in Unit ${unitId}`);
  return row.id;
}

/** Who has edited a Lesson since it was generated. */
export async function lessonEditors(db: Connection['db'], lessonId: string): Promise<string[]> {
  const [row] = await db.select({ editorIds: lessons.editorIds }).from(lessons).where(eq(lessons.id, lessonId));
  return row?.editorIds ?? [];
}
