import type { Actor, VersionReason } from '@lcg/domain';
import type { LessonPromptInput } from '@lcg/generation';
import type { Lesson } from '@lcg/lesson-schema';
import type { OutlineLesson } from '@lcg/outline';
import { and, asc, count, desc, eq, inArray, isNull, max, sql } from 'drizzle-orm';
import type { Database, Executor } from './client.js';
import { readLessonContent, replaceLessonContent } from './documents.js';
import {
  arcs,
  generationAttempts,
  guidanceVersions,
  lessons,
  lessonVersions,
  units,
  type LessonDigest,
} from './schema.js';
import { transitionLesson, type TransitionResult } from './workflow.js';

/** A request to generate one Lesson, as the job queue carries it. */
export interface GenerationJob {
  lessonId: string;
  /** When the Lesson was queued for this job; a job whose Lesson was queued again later is stale. */
  queuedAt: string;
  /** One-off instructions an Editor gave when regenerating. */
  extraInstructions?: string;
}

/** Adds a generation job for a Lesson inside the caller's transaction (see @lcg/queue). */
export type EnqueueGeneration = (tx: Executor, job: GenerationJob) => Promise<void>;

/** Sends a Lesson's generation job, with any pending instructions, and stamps the Lesson with the time it was queued. */
async function sendJob(tx: Executor, lessonId: string, enqueue: EnqueueGeneration, extraInstructions?: string | null) {
  const queuedAt = new Date();
  await tx.update(lessons).set({ jobEnqueuedAt: queuedAt, pendingInstructions: null }).where(eq(lessons.id, lessonId));
  await enqueue(tx, { lessonId, queuedAt: queuedAt.toISOString(), ...(extraInstructions ? { extraInstructions } : {}) });
}

/** Statuses in which a Lesson has content. */
const HAS_CONTENT = ['draft', 'in-review', 'changes-requested', 'approved'] as const;

export interface StartGenerationResult {
  queued: number;
  /** Flex Days queued but waiting for the rest of their Arc to be generated. */
  waiting: number;
}

/**
 * Starts generation for a Unit's Outlined or failed Lessons (all of them, or the
 * given ones): each becomes Queued and its job is sent in the same transaction
 * (ADR 0003). Flex Days are sent once every Lesson in their Arc has content.
 */
export async function startGeneration(
  db: Database,
  input: { unitId: string; lessonIds?: string[]; actor: Actor; enqueue: EnqueueGeneration },
): Promise<StartGenerationResult> {
  return db.transaction(async (tx) => {
    const candidates = await tx
      .select({ id: lessons.id })
      .from(lessons)
      .where(
        and(
          eq(lessons.unitId, input.unitId),
          inArray(lessons.status, ['outlined', 'generation-failed']),
          input.lessonIds ? inArray(lessons.id, input.lessonIds) : undefined,
        ),
      )
      .orderBy(asc(lessons.position));

    let queued = 0;
    for (const { id } of candidates) {
      const result = await transitionLesson(tx, { lessonId: id, actor: input.actor, action: { type: 'queue' } });
      if (result.ok) queued++;
    }
    await enqueueReadyLessons(tx, input.unitId, input.enqueue);
    const [waiting] = await tx
      .select({ n: count() })
      .from(lessons)
      .where(and(eq(lessons.unitId, input.unitId), eq(lessons.status, 'queued'), isNull(lessons.jobEnqueuedAt)));
    return { queued, waiting: waiting?.n ?? 0 };
  });
}

/** Takes a Unit's Queued Lessons out of the queue; jobs already sent find them Outlined and stop. */
export async function cancelGeneration(db: Database, input: { unitId: string; actor: Actor }): Promise<number> {
  return db.transaction(async (tx) => {
    const queued = await tx
      .select({ id: lessons.id })
      .from(lessons)
      .where(and(eq(lessons.unitId, input.unitId), eq(lessons.status, 'queued')));
    for (const { id } of queued) {
      await transitionLesson(tx, { lessonId: id, actor: input.actor, action: { type: 'cancel' } });
      await tx.update(lessons).set({ jobEnqueuedAt: null }).where(eq(lessons.id, id));
    }
    return queued.length;
  });
}

/** Replaces a Draft or Changes Requested Lesson with a fresh generation, with optional one-off instructions. */
export async function regenerateLesson(
  db: Database,
  input: { lessonId: string; actor: Actor; instructions?: string; expectedTransitionCount?: number; enqueue: EnqueueGeneration },
): Promise<TransitionResult> {
  return db.transaction(async (tx) => {
    const instructions = input.instructions?.trim() || undefined;
    const result = await transitionLesson(tx, {
      lessonId: input.lessonId,
      actor: input.actor,
      action: { type: 'regenerate', ...(instructions ? { instructions } : {}) },
      ...(input.expectedTransitionCount !== undefined ? { expectedTransitionCount: input.expectedTransitionCount } : {}),
    });
    if (!result.ok) return result;
    // LCG-9: the content being replaced was dropped from history, so an Editor's
    // changes since generation were lost. It is now kept as a Lesson Version first.
    const current = await readLessonContent(tx, input.lessonId);
    if (current) {
      await captureVersion(tx, {
        lessonId: input.lessonId,
        reason: 'replaced',
        content: current,
        ...(input.actor.kind === 'user' ? { actorId: input.actor.id } : {}),
      });
    }
    // LCG-14: the job was sent at once, so a regenerated Flex Day could run before
    // other Lessons of its Arc being regenerated had content. Regenerated Lessons now
    // go through the same readiness check as everything else, keeping their
    // instructions on the Lesson until the job is sent.
    await tx
      .update(lessons)
      .set({ jobEnqueuedAt: null, pendingInstructions: instructions ?? null })
      .where(eq(lessons.id, input.lessonId));
    const [lesson] = await tx.select({ unitId: lessons.unitId }).from(lessons).where(eq(lessons.id, input.lessonId));
    await enqueueReadyLessons(tx, lesson!.unitId, input.enqueue);
    return result;
  });
}

/**
 * Sends jobs for Queued Lessons that have none yet: every non-Flex Lesson, and
 * each Flex Day whose Arc's other Lessons all have content. Serialised per Unit,
 * so two workers finishing an Arc at once cannot both send its Flex Days.
 */
export async function enqueueReadyLessons(tx: Executor, unitId: string, enqueue: EnqueueGeneration): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${unitId}))`);
  const rows = await tx
    .select({
      id: lessons.id,
      arcId: lessons.arcId,
      lessonType: lessons.lessonType,
      status: lessons.status,
      jobEnqueuedAt: lessons.jobEnqueuedAt,
      pendingInstructions: lessons.pendingInstructions,
    })
    .from(lessons)
    .where(eq(lessons.unitId, unitId));

  const arcReady = (arcId: string) =>
    rows
      .filter((r) => r.arcId === arcId && r.lessonType !== 'flex-day')
      .every((r) => (HAS_CONTENT as readonly string[]).includes(r.status));

  for (const row of rows) {
    if (row.status !== 'queued' || row.jobEnqueuedAt) continue;
    if (row.lessonType === 'flex-day' && !arcReady(row.arcId)) continue;
    await sendJob(tx, row.id, enqueue, row.pendingInstructions);
  }
}

export interface GenerationContext {
  lessonId: string;
  unitId: string;
  status: (typeof lessons.$inferSelect)['status'];
  outline: OutlineLesson;
  unit: typeof units.$inferSelect;
  arcs: (typeof arcs.$inferSelect)[];
  arcName: string;
  previous?: OutlineLesson;
  next?: OutlineLesson;
  guidance: { id: string; text: string };
  digests: { key: string; title: string; digest: LessonDigest }[];
  /** How many Generation Attempts this Lesson already has. */
  attempts: number;
}

/** Everything the prompt for one Lesson needs. */
export async function loadGenerationContext(db: Executor, lessonId: string): Promise<GenerationContext | undefined> {
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId));
  if (!lesson) return undefined;
  const [unit] = await db.select().from(units).where(eq(units.id, lesson.unitId));
  const unitArcs = await db.select().from(arcs).where(eq(arcs.unitId, lesson.unitId)).orderBy(asc(arcs.position));
  const siblings = await db
    .select({ position: lessons.position, outline: lessons.outline, key: lessons.key, title: lessons.title, digest: lessons.digest, arcId: lessons.arcId, lessonType: lessons.lessonType })
    .from(lessons)
    .where(eq(lessons.unitId, lesson.unitId))
    .orderBy(asc(lessons.position));
  const [guidance] = await db
    .select({ id: guidanceVersions.id, text: guidanceVersions.text })
    .from(guidanceVersions)
    .where(eq(guidanceVersions.unitId, lesson.unitId))
    .orderBy(desc(guidanceVersions.version))
    .limit(1);
  const [attempts] = await db.select({ n: count() }).from(generationAttempts).where(eq(generationAttempts.lessonId, lessonId));

  const index = siblings.findIndex((s) => s.position === lesson.position);
  const digests =
    lesson.lessonType === 'flex-day'
      ? siblings
          .filter((s) => s.arcId === lesson.arcId && s.lessonType !== 'flex-day' && s.digest)
          .map((s) => ({ key: s.key, title: s.title, digest: s.digest! }))
      : [];

  return {
    lessonId,
    unitId: lesson.unitId,
    status: lesson.status,
    outline: lesson.outline,
    unit: unit!,
    arcs: unitArcs,
    arcName: unitArcs.find((a) => a.id === lesson.arcId)?.name ?? '',
    ...(siblings[index - 1] ? { previous: siblings[index - 1]!.outline } : {}),
    ...(siblings[index + 1] ? { next: siblings[index + 1]!.outline } : {}),
    guidance: guidance!,
    digests,
    attempts: attempts?.n ?? 0,
  };
}

/**
 * Moves a Queued Lesson to Generating for this job. Returns false when the job
 * should stop: the Lesson was cancelled, already generated, or queued again since.
 *
 * LCG-10: any job for a Generating Lesson was allowed to continue, so a job sent
 * before a cancel ran alongside the job sent after the restart and the Lesson was
 * generated twice. A job now runs only while the Lesson carries the queue stamp it
 * was sent with; retries of the same job carry the same stamp.
 */
export async function beginGenerating(db: Database, job: Pick<GenerationJob, 'lessonId' | 'queuedAt'>): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ status: lessons.status, jobEnqueuedAt: lessons.jobEnqueuedAt })
      .from(lessons)
      .where(eq(lessons.id, job.lessonId))
      .for('update');
    if (!row?.jobEnqueuedAt || row.jobEnqueuedAt.toISOString() !== job.queuedAt) return false;
    if (row.status === 'generating') return true; // a retry of this job after a failed attempt
    if (row.status !== 'queued') return false;
    const result = await transitionLesson(tx, {
      lessonId: job.lessonId,
      actor: { kind: 'system' },
      action: { type: 'start-generating' },
    });
    return result.ok;
  });
}

/** What a finished Generation Attempt records (GLOSSARY: Generation Attempt). */
export interface AttemptRecord {
  guidanceVersionId: string;
  extraInstructions?: string;
  model: string;
  mode: 'live' | 'replay' | 'fake';
  promptVersion: number;
  outcome: 'succeeded' | 'repaired' | 'failed';
  failureReason?: string;
  schemaViolations?: string[];
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  durationMs: number;
  rawOutput?: string;
}

async function recordAttempt(tx: Executor, lessonId: string, attempt: AttemptRecord): Promise<void> {
  await tx.insert(generationAttempts).values({
    lessonId,
    guidanceVersionId: attempt.guidanceVersionId,
    extraInstructions: attempt.extraInstructions ?? null,
    model: attempt.model,
    mode: attempt.mode,
    promptVersion: attempt.promptVersion,
    outcome: attempt.outcome,
    failureReason: attempt.failureReason ?? null,
    schemaViolations: attempt.schemaViolations ?? null,
    inputTokens: attempt.inputTokens,
    outputTokens: attempt.outputTokens,
    cacheReadTokens: attempt.cacheReadTokens,
    cacheWriteTokens: attempt.cacheWriteTokens,
    costUsd: attempt.costUsd.toFixed(4),
    durationMs: attempt.durationMs,
    rawOutput: attempt.rawOutput ?? null,
  });
}

/** Captures an immutable Lesson Version (GLOSSARY: Lesson Version). */
export async function captureVersion(
  tx: Executor,
  input: { lessonId: string; reason: VersionReason; content: Lesson; actorId?: string },
): Promise<void> {
  const [latest] = await tx
    .select({ number: max(lessonVersions.number) })
    .from(lessonVersions)
    .where(eq(lessonVersions.lessonId, input.lessonId));
  await tx.insert(lessonVersions).values({
    lessonId: input.lessonId,
    number: (latest?.number ?? 0) + 1,
    reason: input.reason,
    content: input.content,
    actorId: input.actorId ?? null,
  });
}

/**
 * Stores a successful generation: the Lesson's content (delivered to any open
 * editor), a Lesson Version, the Generation Attempt and Digest, the move to Draft,
 * and any Flex Days that this Lesson completes the Arc for.
 */
export async function completeGeneration(
  db: Database,
  input: { lessonId: string; lesson: Lesson; digest: LessonDigest; attempt: AttemptRecord; enqueue: EnqueueGeneration },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [previous] = await tx.select({ n: count() }).from(lessonVersions).where(eq(lessonVersions.lessonId, input.lessonId));
    await replaceLessonContent(tx, input.lessonId, input.lesson);
    await captureVersion(tx, {
      lessonId: input.lessonId,
      reason: (previous?.n ?? 0) > 0 ? 'regenerated' : 'generated',
      content: input.lesson,
    });
    await recordAttempt(tx, input.lessonId, input.attempt);
    const [row] = await tx
      .update(lessons)
      .set({ digest: input.digest, editorIds: sql`'{}'::uuid[]`, jobEnqueuedAt: null })
      .where(eq(lessons.id, input.lessonId))
      .returning({ unitId: lessons.unitId });
    await transitionLesson(tx, { lessonId: input.lessonId, actor: { kind: 'system' }, action: { type: 'finish-generating' } });
    await enqueueReadyLessons(tx, row!.unitId, input.enqueue);
  });
}

/** Records a failed attempt; on the final attempt the Lesson becomes Generation Failed. */
export async function recordGenerationFailure(
  db: Database,
  input: { lessonId: string; attempt: AttemptRecord; final: boolean },
): Promise<void> {
  await db.transaction(async (tx) => {
    await recordAttempt(tx, input.lessonId, input.attempt);
    if (!input.final) return;
    await tx.update(lessons).set({ jobEnqueuedAt: null }).where(eq(lessons.id, input.lessonId));
    await transitionLesson(tx, {
      lessonId: input.lessonId,
      actor: { kind: 'system' },
      action: { type: 'fail-generating', reason: input.attempt.failureReason ?? 'Generation failed.' },
    });
  });
}

/** The prompt input for a Lesson, from its generation context (shared by the worker and the prompt preview). */
export function promptInputFor(
  context: GenerationContext,
  exampleMarkdown: string,
  extraInstructions?: string,
): LessonPromptInput {
  const { unit } = context;
  return {
    unit: {
      title: unit.title,
      grade: unit.grade,
      unitNumber: unit.unitNumber,
      anchorText: unit.anchorText,
      ...(unit.performanceTask ? { performanceTask: unit.performanceTask } : {}),
    },
    arcs: context.arcs.map((arc) => ({
      name: arc.name,
      description: arc.description,
      ...(arc.performanceTaskSkills ? { performanceTaskSkills: arc.performanceTaskSkills } : {}),
      ...(arc.flexDescription ? { flexDescription: arc.flexDescription } : {}),
    })),
    arcName: context.arcName,
    lesson: context.outline,
    ...(context.previous ? { previous: context.previous } : {}),
    ...(context.next ? { next: context.next } : {}),
    guidance: context.guidance.text,
    example: { lessonType: context.outline.lessonType, markdown: exampleMarkdown },
    ...(context.digests.length > 0 ? { digests: context.digests } : {}),
    ...(extraInstructions ? { extraInstructions } : {}),
  };
}

/**
 * Fails Lessons that have been Generating for longer than any generation takes.
 *
 * LCG-11: when the worker died during a Lesson's last attempt, the queue gave the
 * job up and nothing moved the Lesson on, so it stayed Generating forever. The
 * worker now sweeps for such Lessons and marks them Generation Failed with a
 * reason, so an Editor can retry them.
 */
export async function failStalledGenerations(db: Database, { olderThanMinutes }: { olderThanMinutes: number }): Promise<number> {
  return db.transaction(async (tx) => {
    const stalled = await tx
      .select({ id: lessons.id })
      .from(lessons)
      .where(and(eq(lessons.status, 'generating'), sql`${lessons.updatedAt} < now() - make_interval(mins => ${olderThanMinutes})`));
    for (const { id } of stalled) {
      await tx.update(lessons).set({ jobEnqueuedAt: null }).where(eq(lessons.id, id));
      await transitionLesson(tx, {
        lessonId: id,
        actor: { kind: 'system' },
        action: {
          type: 'fail-generating',
          reason: 'Generation stopped unexpectedly (the worker was interrupted). Retry to generate it again.',
        },
      });
    }
    return stalled.length;
  });
}
