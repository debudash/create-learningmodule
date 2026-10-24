import {
  beginGenerating,
  completeGeneration,
  loadGenerationContext,
  promptInputFor,
  recordGenerationFailure,
  type AttemptRecord,
  type Database,
  type EnqueueGeneration,
  type GenerationContext,
} from '@lcg/db';
import { generateLesson, type GenerationRecord, type LlmClient } from '@lcg/generation';
import type { LessonType } from '@lcg/lesson-schema';

export interface GenerateJobDeps {
  db: Database;
  enqueue: EnqueueGeneration;
  /** The model client for this Lesson (live, replay, or fake built from its Outline row). */
  clientFor: (context: GenerationContext) => LlmClient;
  /** The rendered example Lesson for a Lesson Type (Units 1-3 only; ADR 0007). */
  exampleFor: (lessonType: LessonType) => string;
}

export interface GenerateJob {
  lessonId: string;
  extraInstructions?: string;
}

/**
 * Generates one Lesson. A failure before the last attempt is recorded and thrown so
 * the queue retries it; a failure on the last attempt marks the Lesson Generation Failed.
 */
export async function handleGenerateJob(
  deps: GenerateJobDeps,
  job: GenerateJob,
  { finalAttempt }: { finalAttempt: boolean },
): Promise<void> {
  if (!(await beginGenerating(deps.db, job.lessonId))) return;
  const context = await loadGenerationContext(deps.db, job.lessonId);
  if (!context) return;
  const client = deps.clientFor(context);

  const attemptBase = {
    guidanceVersionId: context.guidance.id,
    ...(job.extraInstructions ? { extraInstructions: job.extraInstructions } : {}),
  };
  let record: GenerationRecord;
  try {
    const result = await generateLesson(
      client,
      promptInputFor(context, deps.exampleFor(context.outline.lessonType), job.extraInstructions),
      recordingKey(context),
    );
    if (result.ok) {
      await completeGeneration(deps.db, {
        lessonId: job.lessonId,
        lesson: result.lesson,
        digest: result.digest,
        attempt: toAttempt(attemptBase, result.record),
        enqueue: deps.enqueue,
      });
      return;
    }
    record = result.record;
  } catch (error) {
    record = {
      outcome: 'failed',
      model: client.model,
      mode: client.mode,
      promptVersion: 0,
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      costUsd: 0,
      durationMs: 0,
      failureReason: `The model could not be reached: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  await recordGenerationFailure(deps.db, { lessonId: job.lessonId, attempt: toAttempt(attemptBase, record), final: finalAttempt });
  if (!finalAttempt) throw new Error(record.failureReason ?? 'Generation failed');
}

/** "g6-u4/L22/attempt-2": stable names for recording a live run and replaying it. */
export function recordingKey(context: GenerationContext): string {
  return `g${context.unit.grade}-u${context.unit.unitNumber}/${context.outline.key}/attempt-${context.attempts + 1}`;
}

function toAttempt(base: Pick<AttemptRecord, 'guidanceVersionId' | 'extraInstructions'>, record: GenerationRecord): AttemptRecord {
  return {
    ...base,
    model: record.model,
    mode: record.mode,
    promptVersion: record.promptVersion,
    outcome: record.outcome,
    ...(record.failureReason ? { failureReason: record.failureReason } : {}),
    ...(record.schemaViolations ? { schemaViolations: record.schemaViolations } : {}),
    inputTokens: record.usage.inputTokens,
    outputTokens: record.usage.outputTokens,
    cacheReadTokens: record.usage.cacheReadTokens,
    cacheWriteTokens: record.usage.cacheWriteTokens,
    costUsd: record.costUsd,
    durationMs: record.durationMs,
    ...(record.rawOutput ? { rawOutput: record.rawOutput } : {}),
  };
}
