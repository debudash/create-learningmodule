'use server';

import { cancelGeneration, regenerateLesson, startGeneration, unitBoard, type EnqueueGeneration } from '@lcg/db';
import type { Actor } from '@lcg/domain';
import { revalidatePath } from 'next/cache';
import { db } from '@/server/db';
import { jobQueue } from '@/server/queue';
import { requireUser } from '@/server/session';

/** How many Lessons a trial batch generates. */
const TRIAL_SIZE = 3;

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

async function actorAndEnqueue(): Promise<{ actor: Actor; enqueue: EnqueueGeneration }> {
  const user = await requireUser();
  const queue = await jobQueue();
  return {
    actor: { kind: 'user', id: user.id, role: user.role },
    enqueue: (tx, job) => queue.enqueue(tx, 'generate-lesson', job),
  };
}

/** Starts generating a trial batch (the first few Outlined Lessons) or every Outlined Lesson. */
export async function startGenerationAction(unitId: string, scope: 'trial' | 'all'): Promise<ActionResult> {
  const { actor, enqueue } = await actorAndEnqueue();
  let lessonIds: string[] | undefined;
  if (scope === 'trial') {
    const board = await unitBoard(db, unitId);
    lessonIds = board?.lessons
      .filter((l) => l.status === 'outlined' && l.lessonType !== 'flex-day')
      .slice(0, TRIAL_SIZE)
      .map((l) => l.id);
  }
  const result = await startGeneration(db, { unitId, actor, enqueue, ...(lessonIds ? { lessonIds } : {}) });
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
  const result = await regenerateLesson(db, { lessonId, actor, instructions, expectedTransitionCount, enqueue });
  return result.ok ? { ok: true, message: 'Regenerating. The Lesson updates when the new draft is ready.' } : result;
}
