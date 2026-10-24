import type { CheckOutlineFacts, QualityCheckResult } from '@lcg/domain';
import type { Lesson } from '@lcg/lesson-schema';
import type { OutlineLesson } from '@lcg/outline';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Executor } from './client.js';
import { readLessonContent } from './documents.js';
import { lessons, qualityCheckResults, units } from './schema.js';

/** The Outline facts the rule checks compare a Lesson with. */
export function checkFactsOf(outline: OutlineLesson): CheckOutlineFacts {
  return {
    focusStandards: outline.focusStandards.map((s) => s.code),
    vocabulary: outline.vocabulary.map((v) => v.word),
  };
}

/** Replaces a Lesson's results from one source; only current results are ever kept. */
export async function replaceCheckResults(
  tx: Executor,
  lessonId: string,
  source: QualityCheckResult['source'],
  results: QualityCheckResult[],
): Promise<void> {
  await tx
    .delete(qualityCheckResults)
    .where(and(eq(qualityCheckResults.lessonId, lessonId), eq(qualityCheckResults.source, source)));
  if (results.length === 0) return;
  await tx.insert(qualityCheckResults).values(
    results.map((r) => ({
      lessonId,
      checkId: r.checkId,
      source: r.source,
      outcome: r.outcome,
      message: r.message,
      location: r.location ?? null,
    })),
  );
}

/** A Lesson's current Quality Check results, AI Review last. */
export async function lessonChecks(db: Executor, lessonId: string): Promise<(QualityCheckResult & { createdAt: Date })[]> {
  const rows = await db
    .select()
    .from(qualityCheckResults)
    .where(eq(qualityCheckResults.lessonId, lessonId))
    .orderBy(asc(qualityCheckResults.source), asc(qualityCheckResults.checkId));
  return rows.map((r) => ({
    checkId: r.checkId,
    source: r.source,
    outcome: r.outcome,
    message: r.message,
    ...(r.location ? { location: r.location } : {}),
    createdAt: r.createdAt,
  }));
}

/** Pass, warn and fail counts for many Lessons at once (the Unit board). */
export async function checkCounts(
  db: Executor,
  lessonIds: string[],
): Promise<Map<string, { pass: number; warn: number; fail: number }>> {
  const counts = new Map<string, { pass: number; warn: number; fail: number }>();
  if (lessonIds.length === 0) return counts;
  const rows = await db
    .select({ lessonId: qualityCheckResults.lessonId, outcome: qualityCheckResults.outcome })
    .from(qualityCheckResults)
    .where(inArray(qualityCheckResults.lessonId, lessonIds));
  for (const row of rows) {
    const entry = counts.get(row.lessonId) ?? { pass: 0, warn: 0, fail: 0 };
    entry[row.outcome] += 1;
    counts.set(row.lessonId, entry);
  }
  return counts;
}

export interface ReviewContext {
  lesson: Lesson;
  outline: OutlineLesson;
  anchorTextTitle: string;
  unit: { grade: number; unitNumber: number };
}

/** What the AI Review of a Lesson needs, or undefined if the Lesson has no content yet. */
export async function loadReviewContext(db: Executor, lessonId: string): Promise<ReviewContext | undefined> {
  const [row] = await db
    .select({ outline: lessons.outline, anchorText: units.anchorText, grade: units.grade, unitNumber: units.unitNumber })
    .from(lessons)
    .innerJoin(units, eq(units.id, lessons.unitId))
    .where(eq(lessons.id, lessonId));
  const lesson = row ? await readLessonContent(db, lessonId) : undefined;
  if (!row || !lesson) return undefined;
  return {
    lesson,
    outline: row.outline,
    anchorTextTitle: row.anchorText.title,
    unit: { grade: row.grade, unitNumber: row.unitNumber },
  };
}
