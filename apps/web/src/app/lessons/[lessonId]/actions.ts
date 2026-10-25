'use server';

import {
  applyReviewAction,
  assignLesson,
  prepareSuggestion,
  recordSuggestion,
  resolveSuggestion,
  restoreVersion,
} from '@lcg/db';
import type { ReviewAction, SuggestionDecision } from '@lcg/domain';
import { suggestActivityChange } from '@lcg/generation';
import type { Activity } from '@lcg/lesson-schema';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/server/action-result';
import { suggestionClientFor } from '@/server/suggestions';
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

export type SuggestionReply =
  | { ok: true; suggestionId: string; before: Activity; after: Activity }
  | { ok: false; message: string };

/**
 * Asks the AI for an AI Suggestion on one Activity, as the Editor sees it now.
 * The suggestion is recorded and returned to this person only (story 123); nothing
 * in the Lesson changes until they accept it in the editor.
 */
export async function requestSuggestionAction(
  lessonId: string,
  activity: unknown,
  action: unknown,
  instruction?: string,
): Promise<SuggestionReply> {
  const actor = await currentActor();
  const prepared = await prepareSuggestion(db, { lessonId, activity, action, ...(instruction ? { instruction } : {}) });
  if (!prepared.ok) return prepared;
  const { request, key } = prepared;
  const result = await suggestActivityChange(await suggestionClientFor(request), request, key);
  const { id } = await recordSuggestion(db, {
    lessonId,
    actor,
    action: request.action,
    before: request.activity,
    result,
    ...(request.instruction ? { instruction: request.instruction } : {}),
  });
  return result.ok
    ? { ok: true, suggestionId: id, before: request.activity, after: result.activity }
    : { ok: false, message: result.reason };
}

/** Records that you accepted (and applied in the editor) or rejected your AI Suggestion. */
export async function resolveSuggestionAction(suggestionId: string, outcome: SuggestionDecision): Promise<ActionResult> {
  const result = await resolveSuggestion(db, { suggestionId, actor: await currentActor(), outcome });
  return result.ok ? { ok: true } : result;
}
