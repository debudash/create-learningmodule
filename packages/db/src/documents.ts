import { lessonToYState, yStateToLesson, type Lesson } from '@lcg/lesson-schema';
import { eq, sql } from 'drizzle-orm';
import type { Executor } from './client.js';
import { recordEditors } from './lessons.js';
import { lessonDocuments, lessons } from './schema.js';

/**
 * The one module through which Lesson content is stored (ADR 0004): the
 * collaboration server saves live Yjs state here, and the worker and API write
 * whole Lessons (generated content, restored versions) here.
 */

export async function loadDocumentState(db: Executor, lessonId: string): Promise<Uint8Array | undefined> {
  const [row] = await db
    .select({ state: lessonDocuments.state })
    .from(lessonDocuments)
    .where(eq(lessonDocuments.lessonId, lessonId));
  return row?.state;
}

export async function storeDocumentState(db: Executor, lessonId: string, state: Uint8Array): Promise<void> {
  await db
    .insert(lessonDocuments)
    .values({ lessonId, state })
    .onConflictDoUpdate({ target: lessonDocuments.lessonId, set: { state, updatedAt: sql`now()` } });
}

/**
 * Stores a Lesson's document together with the facts other screens read from it.
 *
 * LCG-6: the document's title was stored only inside the Yjs state, while the Unit
 * board and breadcrumbs read the Lesson row, so a renamed Lesson kept its old title
 * everywhere but the editor. The row's title is now written with every store.
 */
export async function storeLessonDocument(
  db: Executor,
  lessonId: string,
  state: Uint8Array,
  lesson: Lesson,
  editorIds: string[] = [],
): Promise<void> {
  await db.transaction(async (tx) => {
    await storeDocumentState(tx, lessonId, state);
    await tx.update(lessons).set({ title: lesson.title, updatedAt: sql`now()` }).where(eq(lessons.id, lessonId));
    await recordEditors(tx, lessonId, editorIds);
  });
}

/** Replaces a Lesson's content with a whole Lesson. */
export async function writeLessonContent(db: Executor, lessonId: string, lesson: Lesson): Promise<void> {
  await storeLessonDocument(db, lessonId, lessonToYState(lesson), lesson);
}

/** The Lesson's current content as Lesson JSON, or undefined if it has none yet. */
export async function readLessonContent(db: Executor, lessonId: string): Promise<Lesson | undefined> {
  const state = await loadDocumentState(db, lessonId);
  if (!state) return undefined;
  const result = yStateToLesson(state);
  if (!result.ok) throw new Error(`Lesson ${lessonId} content is invalid: ${result.problems.join('; ')}`);
  return result.lesson;
}
