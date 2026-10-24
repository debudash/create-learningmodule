import { lessonToYState, yStateToLesson, type Lesson } from '@lcg/lesson-schema';
import { eq, sql } from 'drizzle-orm';
import type { Executor } from './client.js';
import { lessonDocuments } from './schema.js';

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

/** Replaces a Lesson's content with a whole Lesson. */
export async function writeLessonContent(db: Executor, lessonId: string, lesson: Lesson): Promise<void> {
  await storeDocumentState(db, lessonId, lessonToYState(lesson));
}

/** The Lesson's current content as Lesson JSON, or undefined if it has none yet. */
export async function readLessonContent(db: Executor, lessonId: string): Promise<Lesson | undefined> {
  const state = await loadDocumentState(db, lessonId);
  if (!state) return undefined;
  const result = yStateToLesson(state);
  if (!result.ok) throw new Error(`Lesson ${lessonId} content is invalid: ${result.problems.join('; ')}`);
  return result.lesson;
}
