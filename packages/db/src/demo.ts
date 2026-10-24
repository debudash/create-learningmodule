import { sampleLessonJson, sampleOutlineCsv } from '@lcg/fixtures';
import { lessonSchema } from '@lcg/lesson-schema';
import { confirmImport, parseOutlineCsv, type ConfirmedImport, type Resolution } from '@lcg/outline';
import { and, eq } from 'drizzle-orm';
import type { Database } from './client.js';
import { replaceLessonContent } from './documents.js';
import { lessons, users } from './schema.js';
import { importUnit } from './units.js';

/** The demo accounts described in docs/users.md. */
export const DEMO_USERS = [
  { name: 'Maya Chen', role: 'editor' },
  { name: 'Jordan Ellis', role: 'editor' },
  { name: 'Sam Rivera', role: 'editor' },
  { name: 'Priya Natarajan', role: 'approver' },
  { name: 'Alex Kim', role: 'approver' },
] as const;

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
export function importSampleUnit(db: Database, actorId: string): Promise<string> {
  return importUnit(db, {
    confirmed: confirmedSampleOutline(),
    source: { kind: 'file', reference: 'g6-u4-lightning-thief.csv' },
    actorId,
    guidance: 'Default guidance',
  });
}

/** Loads the demo: users, the sample Unit 4, and Lesson 3 as a hand-written Draft. */
export async function seedDemo(db: Database): Promise<void> {
  const seeded = await db.insert(users).values([...DEMO_USERS]).returning({ id: users.id });
  const unitId = await importSampleUnit(db, seeded[0]!.id);
  const [lesson] = await db
    .update(lessons)
    .set({ status: 'draft' })
    .where(and(eq(lessons.unitId, unitId), eq(lessons.key, 'L3')))
    .returning({ id: lessons.id });
  await replaceLessonContent(db, lesson!.id, lessonSchema.parse(sampleLessonJson()));
}
