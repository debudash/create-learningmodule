/** Why an accepted AI Suggestion could not go into the Lesson. */
export const CHANGED = 'This Activity has changed since the suggestion was made. Reject it and ask again.';
const MISSING = 'The Activity is no longer in the Lesson.';

/**
 * Accepting an AI Suggestion: put the change into the document, then record it.
 *
 * LCG-26: the suggestion was recorded as accepted before the editor applied it,
 * so a change that could not be applied (the Activity had changed or gone) still
 * appeared in History as accepted. Now nothing is recorded unless the change went
 * in, and a change the server refuses to record (the Lesson was Approved
 * meanwhile) is taken back out, so the record and the Lesson always agree.
 */
export async function acceptSuggestion(steps: {
  apply: () => { ok: true } | { ok: false; reason: 'changed' | 'missing' };
  record: () => Promise<{ ok: true } | { ok: false; message: string }>;
  undo: () => void;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const applied = steps.apply();
  if (!applied.ok) return { ok: false, message: applied.reason === 'changed' ? CHANGED : MISSING };
  const recorded = await steps.record();
  if (!recorded.ok) steps.undo();
  return recorded.ok ? { ok: true } : { ok: false, message: recorded.message };
}
