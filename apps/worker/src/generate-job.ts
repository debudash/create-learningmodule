import {
  beginGenerating,
  completeGeneration,
  loadGenerationContext,
  promptInputFor,
  recordGenerationFailure,
  type Database,
  type EnqueueGeneration,
  type GenerationContext,
  type GenerationJob,
} from '@lcg/db';
import { generateLesson, NO_USAGE, type GenerationAttemptRecord, type LlmClient } from '@lcg/generation';
import type { LessonType } from '@lcg/lesson-schema';

export interface GenerateJobDeps {
  db: Database;
  enqueue: EnqueueGeneration;
  /** The model client for this Lesson (live, replay, or fake built from its Outline row). */
  clientFor: (context: GenerationContext) => LlmClient;
  /** The rendered example Lesson for a Lesson Type (Units 1-3 only; ADR 0007). */
  exampleFor: (lessonType: LessonType) => string;
  /** Asks for the AI Review of a freshly generated Lesson. */
  requestReview?: (lessonId: string) => Promise<void>;
}

/**
 * Generates one Lesson. A failure before the last attempt is recorded and thrown so
 * the queue retries it; a failure on the last attempt marks the Lesson Generation Failed.
 */
export async function handleGenerateJob(
  deps: GenerateJobDeps,
  job: GenerationJob,
  { finalAttempt }: { finalAttempt: boolean },
): Promise<void> {
  if (!(await beginGenerating(deps.db, job))) return;
  const context = await loadGenerationContext(deps.db, job.lessonId);
  if (!context) return;
  const client = deps.clientFor(context);

  const attemptBase = {
    guidanceVersionId: context.guidance.id,
    ...(job.extraInstructions ? { extraInstructions: job.extraInstructions } : {}),
  };
  let record: GenerationAttemptRecord;
  try {
    const result = await generateLesson(
      client,
      promptInputFor(context, deps.exampleFor(context.outline.lessonType), job.extraInstructions),
      recordingKey(context),
    );
    if (result.ok) {
      const stored = await completeGeneration(deps.db, {
        lessonId: job.lessonId,
        lesson: result.lesson,
        digest: result.digest,
        attempt: { ...attemptBase, record: result.record },
        enqueue: deps.enqueue,
      });
      if (stored === 'stored') await deps.requestReview?.(job.lessonId);
      return;
    }
    record = result.record;
  } catch (error) {
    record = {
      outcome: 'failed',
      model: client.model,
      mode: client.mode,
      promptVersion: 0,
      usage: NO_USAGE,
      costUsd: 0,
      durationMs: 0,
      failureReason: `Generation stopped with an unexpected error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  await recordGenerationFailure(deps.db, { lessonId: job.lessonId, attempt: { ...attemptBase, record }, final: finalAttempt });
  if (!finalAttempt) throw new Error(record.failureReason ?? 'Generation failed');
}

/** "g6-u4/L22/attempt-2": stable names for recording a live run and replaying it. */
export function recordingKey(context: GenerationContext): string {
  return `g${context.unit.grade}-u${context.unit.unitNumber}/${context.outline.key}/attempt-${context.attempts + 1}`;
}
