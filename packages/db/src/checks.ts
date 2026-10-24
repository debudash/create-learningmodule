import { NO_CHECKS, type CheckCounts, type CheckOutlineFacts, type QualityCheckResult } from '@lcg/domain';
import type { Lesson } from '@lcg/lesson-schema';
import type { ReviewCall, ReviewFailure } from '@lcg/generation';
import type { OutlineLesson } from '@lcg/outline';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Executor } from './client.js';
import { parseStoredContent } from './documents.js';
import { aiReviews, lessonDocuments, lessons, qualityCheckResults, units } from './schema.js';

/** The Outline facts the rule checks compare a Lesson with. */
export function checkFactsOf(outline: OutlineLesson): CheckOutlineFacts {
  return {
    focusStandards: outline.focusStandards.map((s) => s.code),
    vocabulary: outline.vocabulary.map((v) => v.word),
  };
}

/** True for a result that judged the Lesson's stored content (LCG-19); needs lessons joined. */
export const currentResult = sql<boolean>`${qualityCheckResults.contentDigest} = ${lessons.contentDigest}`;

/**
 * Replaces a Lesson's results from one source. contentDigest names the content
 * the results judged; it defaults to the content stored now.
 */
export async function replaceCheckResults(
  tx: Executor,
  lessonId: string,
  source: QualityCheckResult['source'],
  results: QualityCheckResult[],
  contentDigest?: string,
): Promise<void> {
  const digest = contentDigest ?? (await storedDigest(tx, lessonId));
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
      contentDigest: digest,
    })),
  );
}

/**
 * Saves an AI Review's results for the content it judged.
 *
 * LCG-21: two review jobs for one Lesson each deleted the old results and then
 * inserted their own, outside a transaction, so their statements interleaved and
 * both sets were kept. The replacement now runs in one transaction holding the
 * Lesson row's lock, so reviews that finish together replace one another in turn.
 *
 * LCG-22: the review's model, tokens and cost were computed and then dropped, so
 * the Unit cost left out every review. Every call, readable or not, is now kept
 * in ai_reviews, which the Unit cost sums.
 */
export async function saveAiReview(db: Executor, review: AiReviewRecord): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.select({ id: lessons.id }).from(lessons).where(eq(lessons.id, review.lessonId)).for('update');
    await tx.insert(aiReviews).values({
      lessonId: review.lessonId,
      contentDigest: review.contentDigest,
      model: review.call.model,
      mode: review.call.mode,
      outcome: review.results ? 'reviewed' : review.failure,
      inputTokens: review.call.usage.inputTokens,
      outputTokens: review.call.usage.outputTokens,
      cacheReadTokens: review.call.usage.cacheReadTokens,
      cacheWriteTokens: review.call.usage.cacheWriteTokens,
      costUsd: review.call.costUsd.toFixed(4),
      durationMs: review.call.durationMs,
    });
    if (review.results) {
      await replaceCheckResults(tx, review.lessonId, 'ai-review', review.results, review.contentDigest);
    }
  });
}

/** One AI Review call, with its results or why it has none. */
export type AiReviewRecord = { lessonId: string; contentDigest: string; call: ReviewCall } & (
  | { results: QualityCheckResult[]; failure?: never }
  | { results?: never; failure: ReviewFailure }
);

/** The Lesson's most recent AI Review call, and whether it judged the stored content. */
export async function latestAiReview(db: Executor, lessonId: string): Promise<LastAiReview | undefined> {
  const [row] = await db
    .select({
      outcome: aiReviews.outcome,
      at: aiReviews.createdAt,
      current: sql<boolean>`${aiReviews.contentDigest} = ${lessons.contentDigest}`,
    })
    .from(aiReviews)
    .innerJoin(lessons, eq(lessons.id, aiReviews.lessonId))
    .where(eq(aiReviews.lessonId, lessonId))
    .orderBy(desc(aiReviews.createdAt))
    .limit(1);
  return row;
}

export interface LastAiReview {
  outcome: 'reviewed' | ReviewFailure;
  at: Date;
  current: boolean;
}

async function storedDigest(db: Executor, lessonId: string): Promise<string> {
  const [row] = await db.select({ digest: lessons.contentDigest }).from(lessons).where(eq(lessons.id, lessonId));
  return row?.digest ?? '';
}

/** Quality Checks failing on the Lesson's stored content. */
export async function currentFailingChecks(db: Executor, lessonId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(qualityCheckResults)
    .innerJoin(lessons, eq(lessons.id, qualityCheckResults.lessonId))
    .where(and(eq(qualityCheckResults.lessonId, lessonId), eq(qualityCheckResults.outcome, 'fail'), currentResult));
  return row?.n ?? 0;
}

/**
 * A Lesson's Quality Check results, AI Review last. An AI Review of earlier content
 * is kept for reference but marked not current; it no longer counts.
 */
export async function lessonChecks(
  db: Executor,
  lessonId: string,
): Promise<(QualityCheckResult & { createdAt: Date; current: boolean })[]> {
  const rows = await db
    .select({ result: qualityCheckResults, current: currentResult })
    .from(qualityCheckResults)
    .innerJoin(lessons, eq(lessons.id, qualityCheckResults.lessonId))
    .where(eq(qualityCheckResults.lessonId, lessonId))
    .orderBy(asc(qualityCheckResults.source), asc(qualityCheckResults.checkId));
  return rows.map(({ result: r, current }) => ({
    checkId: r.checkId,
    source: r.source,
    outcome: r.outcome,
    message: r.message,
    ...(r.location ? { location: r.location } : {}),
    createdAt: r.createdAt,
    current,
  }));
}

/** Pass, warn and fail counts of current results for many Lessons at once (the Unit board). */
export async function checkCounts(
  db: Executor,
  lessonIds: string[],
): Promise<Map<string, CheckCounts>> {
  const counts = new Map<string, CheckCounts>();
  if (lessonIds.length === 0) return counts;
  const rows = await db
    .select({ lessonId: qualityCheckResults.lessonId, outcome: qualityCheckResults.outcome })
    .from(qualityCheckResults)
    .innerJoin(lessons, eq(lessons.id, qualityCheckResults.lessonId))
    .where(and(inArray(qualityCheckResults.lessonId, lessonIds), currentResult));
  for (const row of rows) {
    const entry = counts.get(row.lessonId) ?? { ...NO_CHECKS };
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
  /** Digest of the content under review; its results judge this content only. */
  contentDigest: string;
}

/**
 * What the AI Review of a Lesson needs, or undefined if the Lesson has no content yet.
 *
 * LCG-20: a review saved its results as judging whatever content was stored when
 * it finished, so a review of content edited mid-review counted as current. The
 * content and its digest are now read in one statement, and the review's results
 * carry that digest.
 */
export async function loadReviewContext(db: Executor, lessonId: string): Promise<ReviewContext | undefined> {
  const [row] = await db
    .select({
      outline: lessons.outline,
      contentDigest: lessons.contentDigest,
      state: lessonDocuments.state,
      anchorText: units.anchorText,
      grade: units.grade,
      unitNumber: units.unitNumber,
    })
    .from(lessons)
    .innerJoin(units, eq(units.id, lessons.unitId))
    .innerJoin(lessonDocuments, eq(lessonDocuments.lessonId, lessons.id))
    .where(eq(lessons.id, lessonId));
  if (!row?.contentDigest) return undefined;
  return {
    lesson: parseStoredContent(lessonId, row.state),
    contentDigest: row.contentDigest,
    outline: row.outline,
    anchorTextTitle: row.anchorText.title,
    unit: { grade: row.grade, unitNumber: row.unitNumber },
  };
}
