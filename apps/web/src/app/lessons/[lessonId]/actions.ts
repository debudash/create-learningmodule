'use server';

import { applyReviewAction, assignLesson, restoreVersion } from '@lcg/db';
import type { ReviewAction } from '@lcg/domain';
import { revalidatePath } from 'next/cache';
import { saveLessonNow } from '@/server/collab';
import { db } from '@/server/db';
import { requireUser } from '@/server/session';

export type ActionResult = { ok: true } | { ok: false; message: string };

/** Submit, approve, request changes or reopen, as the signed-in person. */
export async function reviewLessonAction(
  lessonId: string,
  action: ReviewAction,
  expectedTransitionCount: number,
): Promise<ActionResult> {
  const user = await requireUser();
  // Submitting and approving freeze a Version; first save any edits still open in the editor.
  if (action.type === 'submit' || action.type === 'approve') await saveLessonNow(lessonId);
  const result = await applyReviewAction(db, {
    lessonId,
    actor: { kind: 'user', id: user.id, role: user.role },
    action,
    expectedTransitionCount,
  });
  revalidatePath(`/lessons/${lessonId}`);
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}

/** Claims the Lesson for the signed-in person, or releases it. */
export async function assignLessonAction(lessonId: string, claim: boolean): Promise<ActionResult> {
  const user = await requireUser();
  await assignLesson(db, { lessonId, assigneeId: claim ? user.id : null });
  revalidatePath(`/lessons/${lessonId}`);
  return { ok: true };
}

/** Makes an earlier Lesson Version the current content again. */
export async function restoreVersionAction(lessonId: string, versionId: string): Promise<ActionResult> {
  const user = await requireUser();
  const result = await restoreVersion(db, { lessonId, versionId, actor: { kind: 'user', id: user.id, role: user.role } });
  revalidatePath(`/lessons/${lessonId}`);
  return result;
}
