import { mayUseAiTools, type Actor, type AiEditAction } from '@lcg/domain';
import type { EditResult } from '@lcg/generation';
import type { Activity } from '@lcg/lesson-schema';
import { eq, sql } from 'drizzle-orm';
import type { Executor } from './client.js';
import { aiSuggestions, lessons } from './schema.js';

/**
 * AI Suggestions as records (ADR 0001: the content change itself is an ordinary
 * edit in the editor). Every suggestion is kept with its cost; accepted ones are
 * part of the Lesson's history.
 */

export interface SuggestionRequest {
  lessonId: string;
  actor: Actor & { kind: 'user' };
  action: AiEditAction;
  instruction?: string;
  /** The Activity as the Editor saw it when asking. */
  before: Activity;
  result: EditResult;
}

/** Records a suggestion the model returned, or failed to return. */
export async function recordSuggestion(db: Executor, request: SuggestionRequest): Promise<{ id: string }> {
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
      model: result.call.model,
      mode: result.call.mode,
      inputTokens: result.call.usage.inputTokens,
      outputTokens: result.call.usage.outputTokens,
      cacheReadTokens: result.call.usage.cacheReadTokens,
      cacheWriteTokens: result.call.usage.cacheWriteTokens,
      costUsd: result.call.costUsd.toFixed(4),
      durationMs: result.call.durationMs,
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
  request: { suggestionId: string; actor: Actor & { kind: 'user' }; outcome: 'accepted' | 'rejected' },
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
    if (request.outcome === 'accepted' && !mayUseAiTools(row.status)) {
      return { ok: false, message: 'The Lesson is Approved or being generated, so it cannot change now.' };
    }
    await tx
      .update(aiSuggestions)
      .set({ outcome: request.outcome, resolvedAt: sql`now()` })
      .where(eq(aiSuggestions.id, request.suggestionId));
    return { ok: true };
  });
}
