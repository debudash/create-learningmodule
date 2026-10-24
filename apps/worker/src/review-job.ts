import { loadReviewContext, saveAiReview, type Database, type ReviewContext } from '@lcg/db';
import { reviewLesson, type LlmClient } from '@lcg/generation';

export interface ReviewJobDeps {
  db: Database;
  /** The reviewing model (live, replay, or fake answering "taught" for every Focus Standard). */
  clientFor: (context: ReviewContext) => LlmClient;
}

/**
 * Runs the AI Review of one Lesson and replaces its AI Review results. A Lesson
 * without content is skipped; a review that cannot be read is thrown so the queue
 * retries it.
 */
export async function handleReviewJob(deps: ReviewJobDeps, job: { lessonId: string }): Promise<void> {
  const context = await loadReviewContext(deps.db, job.lessonId);
  if (!context) return;
  const key = `g${context.unit.grade}-u${context.unit.unitNumber}/${context.outline.key}/review`;
  const result = await reviewLesson(deps.clientFor(context), context, key);
  const record = { lessonId: job.lessonId, contentDigest: context.contentDigest, call: result.call };
  await saveAiReview(deps.db, result.ok ? { ...record, results: result.results } : record);
  if (!result.ok) throw new Error(result.reason);
}
