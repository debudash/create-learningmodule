'use server';

import {
  approveLessons,
  cancelGeneration,
  liveGenerationsToday,
  regenerateLesson,
  startGeneration,
  unitBoard,
  type EnqueueGeneration,
} from '@lcg/db';
import { generationAllowance, TRIAL_BATCH_SIZE, type Actor, type Allowance } from '@lcg/domain';
import { revalidatePath } from 'next/cache';
import { db } from '@/server/db';
import { jobQueue } from '@/server/queue';
import { requireUser } from '@/server/session';

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

async function actorAndEnqueue(): Promise<{ actor: Actor & { kind: 'user' }; enqueue: EnqueueGeneration }> {
  const user = await requireUser();
  const queue = await jobQueue();
  return {
    actor: { kind: 'user', id: user.id, role: user.role },
    enqueue: (tx, job) => queue.enqueue(tx, 'generate-lesson', job),
  };
}

/** The hosted demo's limits on live generation (PRD story 56), from the environment. */
async function allowance(actor: Actor & { kind: 'user' }, requested: number): Promise<Allowance> {
  const cap = process.env.GENERATION_DAILY_CAP;
  return generationAllowance({
    role: actor.role,
    live: process.env.LLM_MODE === 'live',
    limits: {
      approversOnly: process.env.LIVE_GENERATION_APPROVERS_ONLY === 'true',
      ...(cap ? { dailyCap: Number(cap) } : {}),
    },
    generatedToday: await liveGenerationsToday(db),
    requested,
  });
}

/** Starts generating a trial batch (the first few Outlined Lessons) or every Outlined Lesson. */
export async function startGenerationAction(unitId: string, scope: 'trial' | 'all'): Promise<ActionResult> {
  const { actor, enqueue } = await actorAndEnqueue();
  const board = await unitBoard(db, unitId);
  const outlined = board?.lessons.filter((l) => l.status === 'outlined').length ?? 0;
  const allowed = await allowance(actor, scope === 'trial' ? Math.min(TRIAL_BATCH_SIZE, outlined) : outlined);
  if (!allowed.ok) return allowed;
  const result = await startGeneration(db, { unitId, actor, enqueue, trial: scope === 'trial' });
  revalidatePath(`/units/${unitId}`);
  if (result.queued === 0) return { ok: false, message: 'There are no Outlined Lessons to generate.' };
  return {
    ok: true,
    message:
      `${result.queued} Lesson${result.queued === 1 ? '' : 's'} queued for generation.` +
      (result.waiting > 0 ? ` ${result.waiting} Flex Day${result.waiting === 1 ? ' waits' : 's wait'} for its Arc.` : ''),
  };
}

/** Takes every Queued Lesson of the Unit out of the queue. */
export async function cancelGenerationAction(unitId: string): Promise<ActionResult> {
  const { actor } = await actorAndEnqueue();
  const cancelled = await cancelGeneration(db, { unitId, actor });
  revalidatePath(`/units/${unitId}`);
  return { ok: true, message: `${cancelled} Lesson${cancelled === 1 ? '' : 's'} taken out of the queue.` };
}

/** Tries a Lesson whose generation failed again. */
export async function retryLessonAction(unitId: string, lessonId: string): Promise<ActionResult> {
  const { actor, enqueue } = await actorAndEnqueue();
  const allowed = await allowance(actor, 1);
  if (!allowed.ok) return allowed;
  const result = await startGeneration(db, { unitId, lessonIds: [lessonId], actor, enqueue });
  revalidatePath(`/units/${unitId}`);
  return result.queued > 0 ? { ok: true, message: 'Queued again.' } : { ok: false, message: 'This Lesson cannot be retried.' };
}

/** Replaces a Draft or Changes Requested Lesson with a fresh generation. */
export async function regenerateLessonAction(
  lessonId: string,
  instructions: string,
  expectedTransitionCount: number,
): Promise<ActionResult> {
  const { actor, enqueue } = await actorAndEnqueue();
  const allowed = await allowance(actor, 1);
  if (!allowed.ok) return allowed;
  const result = await regenerateLesson(db, { lessonId, actor, instructions, expectedTransitionCount, enqueue });
  return result.ok ? { ok: true, message: 'Regenerating. The Lesson updates when the new draft is ready.' } : result;
}

/** Approves the selected In Review Lessons (Approvers only; each Lesson succeeds or is refused on its own). */
export async function approveLessonsAction(unitId: string, lessonIds: string[]): Promise<ActionResult> {
  const { actor } = await actorAndEnqueue();
  const result = await approveLessons(db, { lessonIds, actor });
  revalidatePath(`/units/${unitId}`);
  if (result.refused.length === 0) return { ok: true, message: `${result.approved.length} Lessons Approved.` };
  return {
    ok: result.approved.length > 0,
    message: `${result.approved.length} Approved; ${result.refused.length} could not be: ${result.refused[0]!.message}`,
  };
}
