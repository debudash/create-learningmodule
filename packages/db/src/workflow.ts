import { decide, type Actor, type LessonAction, type LessonStatus, type Refusal } from '@lcg/domain';
import { eq, sql } from 'drizzle-orm';
import { notifyLessonChange } from './channels.js';
import { currentFailingChecks } from './checks.js';
import type { Executor } from './client.js';
import { lessons, workflowEvents } from './schema.js';

export type TransitionResult =
  | { ok: true; from: LessonStatus; to: LessonStatus }
  | { ok: false; refusal: Refusal | 'stale' | 'not-found'; message: string };

export interface TransitionRequest {
  lessonId: string;
  actor: Actor;
  action: LessonAction;
  /** The transition count the caller last saw; a different current count means someone else acted first. */
  expectedTransitionCount?: number;
}

/**
 * Applies one workflow action to a Lesson inside the caller's transaction: decides
 * it with the domain rules, updates the status under a row lock, records the
 * workflow event, and announces the change (open editors reconnect under the new
 * status).
 */
export async function transitionLesson(tx: Executor, request: TransitionRequest): Promise<TransitionResult> {
  const { lessonId, actor, action } = request;
  const [lesson] = await tx
    .select({ status: lessons.status, transitionCount: lessons.transitionCount, editorIds: lessons.editorIds })
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .for('update');
  if (!lesson) return { ok: false, refusal: 'not-found', message: 'No such Lesson.' };
  if (request.expectedTransitionCount !== undefined && request.expectedTransitionCount !== lesson.transitionCount) {
    return {
      ok: false,
      refusal: 'stale',
      message: 'Someone else changed this Lesson a moment ago. Reload to see its current state.',
    };
  }

  const failingChecks = await currentFailingChecks(tx, lessonId);
  const decision = decide(lesson.status, actor, action, { editorIds: lesson.editorIds, failingChecks });
  if (!decision.ok) return { ok: false, refusal: decision.refusal, message: decision.message };

  await tx
    .update(lessons)
    .set({ status: decision.to, transitionCount: sql`${lessons.transitionCount} + 1`, updatedAt: sql`now()` })
    .where(eq(lessons.id, lessonId));
  await tx.insert(workflowEvents).values({
    lessonId,
    actorId: actor.kind === 'user' ? actor.id : null,
    action: action.type,
    fromStatus: lesson.status,
    toStatus: decision.to,
    reason: reasonOf(action),
    selfApproval: decision.flags.selfApproval,
    overFailingChecks: decision.flags.overFailingChecks,
  });
  await notifyLessonChange(tx, 'status', lessonId);
  return { ok: true, from: lesson.status, to: decision.to };
}

function reasonOf(action: LessonAction): string | null {
  if ('reason' in action) return action.reason;
  if (action.type === 'regenerate') return action.instructions ?? null;
  return null;
}
