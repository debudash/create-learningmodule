'use server';

import {
  applyReviewAction,
  assignLesson,
  readLessonContent,
  recordSuggestion,
  resolveSuggestion,
  restoreVersion,
  workspaceLesson,
} from '@lcg/db';
import { mayUseAiTools, needsInstruction, parseAiEditAction, type ReviewAction } from '@lcg/domain';
import { suggestActivityEdit } from '@lcg/generation';
import { activitySchema, type Activity } from '@lcg/lesson-schema';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/server/action-result';
import { editClientFor } from '@/server/ai-editing';
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

export type SuggestionResult =
  | { ok: true; suggestionId: string; before: Activity; after: Activity }
  | { ok: false; message: string };

/**
 * Asks the AI for an AI Suggestion on one Activity, as the Editor sees it now.
 * The suggestion is recorded and returned to this person only (story 123); nothing
 * in the Lesson changes until they accept it in the editor.
 */
export async function suggestEditAction(
  lessonId: string,
  activity: unknown,
  actionName: unknown,
  instruction?: string,
): Promise<SuggestionResult> {
  const actor = await currentActor();
  const action = parseAiEditAction(actionName);
  const before = activitySchema.safeParse(activity);
  if (!action || !before.success) return { ok: false, message: 'That is not something the AI can do here.' };
  if (needsInstruction(action) && !instruction?.trim()) return { ok: false, message: 'Say what you want changed.' };
  const lesson = await workspaceLesson(db, lessonId);
  if (!lesson || !mayUseAiTools(lesson.status)) {
    return { ok: false, message: 'AI tools are off while a Lesson is Approved or being generated.' };
  }
  const content = await readLessonContent(db, lessonId);
  if (!content?.sections.some((s) => s.activities.some((a) => a.id === before.data.id))) {
    return { ok: false, message: 'That Activity is not in this Lesson.' };
  }

  const request = { lesson: content, activity: before.data, action, ...(instruction?.trim() ? { instruction: instruction.trim() } : {}) };
  const key = `g${lesson.unit.grade}-u${lesson.unit.unitNumber}/${lesson.key}/edit-${action}-${before.data.id}`;
  const result = await suggestActivityEdit(await editClientFor(request), request, key);
  const { id } = await recordSuggestion(db, {
    lessonId,
    actor,
    action,
    before: before.data,
    result,
    ...(request.instruction ? { instruction: request.instruction } : {}),
  });
  return result.ok
    ? { ok: true, suggestionId: id, before: before.data, after: result.activity }
    : { ok: false, message: result.reason };
}

/** Records that you accepted (and applied in the editor) or rejected your AI Suggestion. */
export async function resolveSuggestionAction(suggestionId: string, outcome: 'accepted' | 'rejected'): Promise<ActionResult> {
  const result = await resolveSuggestion(db, { suggestionId, actor: await currentActor(), outcome });
  return result.ok ? { ok: true } : result;
}
