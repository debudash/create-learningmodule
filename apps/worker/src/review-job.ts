import { loadReviewContext, saveAiReview, type Database, type ReviewContext } from '@lcg/db';
import { reviewKey, reviewLesson, type LlmClient } from '@lcg/generation';

export interface ReviewJobDeps {
  db: Database;
  /** The reviewing model (live, replay, or fake answering "taught" for every Focus Standard). */
  clientFor: (context: ReviewContext) => LlmClient;
}

/**
 * Runs the AI Review of one Lesson and replaces its AI Review results. A Lesson
 * without content is skipped; every call is recorded; a reply that cannot be read
 * is thrown so the queue retries it, and a review replay mode cannot serve is not.
 */
export async function handleReviewJob(deps: ReviewJobDeps, job: { lessonId: string }): Promise<void> {
  const context = await loadReviewContext(deps.db, job.lessonId);
  if (!context) return;
  const result = await reviewLesson(deps.clientFor(context), context, reviewKey(context));
  const record = { lessonId: job.lessonId, contentDigest: context.contentDigest, call: result.call };
  await saveAiReview(deps.db, result.ok ? { ...record, results: result.results } : { ...record, failure: result.failure });
  if (!result.ok && result.failure === 'unreadable') throw new Error(result.reason);
}
