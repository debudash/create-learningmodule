import {
  isEditable,
  needsInstruction,
  parseAiSuggestionAction,
  type Actor,
  type AiSuggestionAction,
  type SuggestionDecision,
} from '@lcg/domain';
import { suggestionKey, type SuggestionRequest, type SuggestionResult } from '@lcg/generation';
import { activitySchema, type Activity } from '@lcg/lesson-schema';
import { eq, sql } from 'drizzle-orm';
import type { Executor } from './client.js';
import { modelCallValues } from './model-calls.js';
import { readLessonContent } from './documents.js';
import { aiSuggestions, lessons, units } from './schema.js';

/**
 * AI Suggestions as records (ADR 0001: the content change itself is an ordinary
 * edit in the editor). Every suggestion is kept with its cost; accepted ones are
 * part of the Lesson's history.
 */

export type PreparedSuggestion = { ok: true; request: SuggestionRequest; key: string } | { ok: false; message: string };

/**
 * Checks a request for an AI Suggestion from the browser and builds what the
 * model is sent: the action, the Activity as the Editor sees it (their copy may
 * be newer than what is stored), and the stored Lesson as context. Refused on
 * Lessons that cannot be edited (story 125), for unknown actions, and for
 * Activities that are not in the Lesson.
 */
export async function prepareSuggestion(
  db: Executor,
  input: { lessonId: string; activity: unknown; action: unknown; instruction?: string },
): Promise<PreparedSuggestion> {
  const action = parseAiSuggestionAction(input.action);
  const activity = activitySchema.safeParse(input.activity);
  if (!action || !activity.success) return { ok: false, message: 'That is not something the AI can do here.' };
  const instruction = input.instruction?.trim();
  if (needsInstruction(action) && !instruction) return { ok: false, message: 'Say what you want changed.' };

  const [lesson] = await db
    .select({ key: lessons.key, status: lessons.status, grade: units.grade, unitNumber: units.unitNumber })
    .from(lessons)
    .innerJoin(units, eq(units.id, lessons.unitId))
    .where(eq(lessons.id, input.lessonId));
  if (!lesson || !isEditable(lesson.status)) {
    return { ok: false, message: 'AI Suggestions are off while a Lesson is Approved or being generated.' };
  }
  const content = await readLessonContent(db, input.lessonId);
  if (!content?.sections.some((s) => s.activities.some((a) => a.id === activity.data.id))) {
    return { ok: false, message: 'That Activity is not in this Lesson.' };
  }
  return {
    ok: true,
    request: { lesson: content, activity: activity.data, action, ...(instruction ? { instruction } : {}) },
    key: suggestionKey({ unit: lesson, lessonKey: lesson.key, action, activityId: activity.data.id }),
  };
}

export interface SuggestionRecord {
  lessonId: string;
  actor: Actor & { kind: 'user' };
  action: AiSuggestionAction;
  instruction?: string;
  /** The Activity as the Editor saw it when asking. */
  before: Activity;
  result: SuggestionResult;
}

/** Records a suggestion the model returned, or failed to return. */
export async function recordSuggestion(db: Executor, request: SuggestionRecord): Promise<{ id: string }> {
  const { result } = request;
  const [row] = await db
    .insert(aiSuggestions)
    .values({
      lessonId: request.lessonId,
      actorId: request.actor.id,
      action: request.action,
      instruction: request.instruction ?? null,
      activityId: request.before.id,
      before: request.before,
      after: result.ok ? result.activity : null,
      outcome: result.ok ? 'pending' : 'failed',
      failureReason: result.ok ? null : result.reason,
      ...modelCallValues(result.call),
    })
    .returning({ id: aiSuggestions.id });
  return { id: row!.id };
}

export type ResolveResult = { ok: true } | { ok: false; message: string };

/**
 * Records that the person who asked for a suggestion accepted or rejected it. A
 * suggestion is resolved once; accepting needs the Lesson to be editable still.
 */
export async function resolveSuggestion(
  db: Executor,
  request: { suggestionId: string; actor: Actor & { kind: 'user' }; outcome: SuggestionDecision },
): Promise<ResolveResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ actorId: aiSuggestions.actorId, outcome: aiSuggestions.outcome, status: lessons.status })
      .from(aiSuggestions)
      .innerJoin(lessons, eq(lessons.id, aiSuggestions.lessonId))
      .where(eq(aiSuggestions.id, request.suggestionId))
      .for('update');
    if (!row || row.actorId !== request.actor.id) return { ok: false, message: 'No such AI Suggestion of yours.' };
    if (row.outcome !== 'pending') return { ok: false, message: 'This AI Suggestion has already been dealt with.' };
    if (request.outcome === 'accepted' && !isEditable(row.status)) {
      return { ok: false, message: 'The Lesson is Approved or being generated, so it cannot change now.' };
    }
    await tx
      .update(aiSuggestions)
      .set({ outcome: request.outcome, resolvedAt: sql`now()` })
      .where(eq(aiSuggestions.id, request.suggestionId));
    return { ok: true };
  });
}
