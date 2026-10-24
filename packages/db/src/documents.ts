import {
  mergeYStates,
  replaceLessonInYState,
  yStateToLesson,
  type Lesson,
} from '@lcg/lesson-schema';
import { runRuleChecks } from '@lcg/domain';
import { createHash } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { notifyLessonChange } from './channels.js';
import type { Executor } from './client.js';
import { checkFactsOf, replaceCheckResults } from './checks.js';
import { recordEditors } from './lessons.js';
import { lessonDocuments, lessons } from './schema.js';

/**
 * The one module through which Lesson content is stored (ADR 0004). The
 * collaboration server saves live Yjs state with saveLiveDocument; the worker and
 * API replace whole Lessons (generated content, restored versions) with
 * replaceLessonContent. Both merge with what is stored, so neither can overwrite
 * the other's changes.
 */

/** A digest of a Lesson's content, stored with it so results can say which content they judged. */
export function contentDigestOf(lesson: Lesson): string {
  return createHash('sha256').update(JSON.stringify(lesson)).digest('hex');
}

export async function loadDocumentState(db: Executor, lessonId: string): Promise<Uint8Array | undefined> {
  const [row] = await db
    .select({ state: lessonDocuments.state })
    .from(lessonDocuments)
    .where(eq(lessonDocuments.lessonId, lessonId));
  return row?.state;
}

/** The stored state, locked until the transaction ends. */
async function lockedState(tx: Executor, lessonId: string): Promise<Uint8Array | undefined> {
  const [row] = await tx
    .select({ state: lessonDocuments.state })
    .from(lessonDocuments)
    .where(eq(lessonDocuments.lessonId, lessonId))
    .for('update');
  return row?.state;
}

/**
 * Writes a document with the facts other screens read from it: the title and the
 * Rule-Based Quality Checks, so stored results always describe the stored content.
 *
 * LCG-6: the title lived only inside the Yjs state while the Unit board read the
 * Lesson row, so a renamed Lesson kept its old title outside the editor. The row's
 * title is written with every store, in the same transaction.
 *
 * LCG-19: AI Review results outlived the content they judged, so the board, the
 * approval warning and the failing filter counted verdicts on old content. Every
 * store now writes the content's digest; a result counts only while it judged the
 * stored digest (see currentResult in checks.ts).
 */
async function write(tx: Executor, lessonId: string, state: Uint8Array, lesson: Lesson, editorIds: string[]) {
  await tx
    .insert(lessonDocuments)
    .values({ lessonId, state })
    .onConflictDoUpdate({ target: lessonDocuments.lessonId, set: { state, updatedAt: sql`now()` } });
  const contentDigest = contentDigestOf(lesson);
  const [row] = await tx
    .update(lessons)
    .set({ title: lesson.title, contentDigest, updatedAt: sql`now()` })
    .where(eq(lessons.id, lessonId))
    .returning({ outline: lessons.outline });
  await recordEditors(tx, lessonId, editorIds);
  if (row) {
    await replaceCheckResults(tx, lessonId, 'rule', runRuleChecks(lesson, checkFactsOf(row.outline)), contentDigest);
  }
}

export type SaveOutcome = 'stored' | 'invalid';

/**
 * Saves the collaboration server's copy of a document, merged with what is stored.
 * LCG-5: only a valid Lesson is stored; otherwise the last good content is kept.
 */
export async function saveLiveDocument(
  db: Executor,
  lessonId: string,
  state: Uint8Array,
  editorIds: string[],
): Promise<SaveOutcome> {
  return db.transaction(async (tx) => {
    const stored = await lockedState(tx, lessonId);
    const merged = stored ? mergeYStates(stored, state) : state;
    const parsed = yStateToLesson(merged);
    if (!parsed.ok) return 'invalid';
    await write(tx, lessonId, merged, parsed.lesson, editorIds);
    return 'stored';
  });
}

/**
 * Replaces a Lesson's content with a whole Lesson and tells the collaboration
 * server, which applies it to any open copy.
 *
 * LCG-7: whole-Lesson writes replaced the stored bytes directly, so an open
 * document on the collaboration server never saw them and overwrote them on its
 * next save, and editors' copies could re-merge the old content. The replacement
 * is now a Yjs change on top of the stored state (it merges with every copy), and
 * a notification makes the collaboration server apply it to its open copy.
 */
export async function replaceLessonContent(db: Executor, lessonId: string, lesson: Lesson): Promise<void> {
  await db.transaction(async (tx) => {
    const state = replaceLessonInYState(await lockedState(tx, lessonId), lesson);
    await write(tx, lessonId, state, lesson, []);
    await notifyLessonChange(tx, 'document', lessonId);
  });
}

/** The Lesson's current content as Lesson JSON, or undefined if it has none yet. */
export async function readLessonContent(db: Executor, lessonId: string): Promise<Lesson | undefined> {
  const state = await loadDocumentState(db, lessonId);
  if (!state) return undefined;
  const result = yStateToLesson(state);
  if (!result.ok) throw new Error(`Lesson ${lessonId} content is invalid: ${result.problems.join('; ')}`);
  return result.lesson;
}
