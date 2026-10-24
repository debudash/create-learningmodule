'use server';

import { applyReviewAction, assignLesson, restoreVersion } from '@lcg/db';
import type { ReviewAction } from '@lcg/domain';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/server/action-result';
import { saveLessonNow } from '@/server/collab';
import { db } from '@/server/db';
import { jobQueue } from '@/server/queue';
import { currentActor } from '@/server/session';

/** Submit, approve, request changes or reopen, as the signed-in person. */
export async function reviewLessonAction(
  lessonId: string,
  action: ReviewAction,
  expectedTransitionCount: number,
): Promise<ActionResult> {
  const actor = await currentActor();
  // Submitting and approving freeze a Version; first save any edits still open in the editor.
  if (action.type === 'submit' || action.type === 'approve') await saveLessonNow(lessonId);
  const result = await applyReviewAction(db, { lessonId, actor, action, expectedTransitionCount });
  revalidatePath(`/lessons/${lessonId}`);
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}

/** Sets the Lesson's Assignee: yourself, nobody, or (for Approvers) a colleague. */
export async function assignLessonAction(lessonId: string, assigneeId: string | null): Promise<ActionResult> {
  const result = await assignLesson(db, { lessonId, assigneeId, actor: await currentActor() });
  revalidatePath(`/lessons/${lessonId}`);
  return result;
}

/** Makes an earlier Lesson Version the current content again. */
export async function restoreVersionAction(lessonId: string, versionId: string): Promise<ActionResult> {
  const result = await restoreVersion(db, { lessonId, versionId, actor: await currentActor() });
  revalidatePath(`/lessons/${lessonId}`);
  return result;
}

/** Asks for a fresh AI Review of the Lesson; results appear when the worker has run it. */
export async function requestReviewAction(lessonId: string): Promise<ActionResult> {
  await currentActor();
  const queue = await jobQueue();
  await db.transaction((tx) => queue.enqueue(tx, 'review-lesson', { lessonId }));
  return { ok: true, message: 'Review requested; reload in a minute to see it.' };
}
