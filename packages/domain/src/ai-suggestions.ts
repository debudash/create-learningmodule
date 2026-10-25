/**
 * What an Editor can ask the AI to do to one Activity (PRD stories 118-121), in
 * build order. Every result is an AI Suggestion the Editor accepts or rejects. AI
 * Suggestions follow editing: only on Lessons that can be edited (isEditable, story 125).
 */
export const AI_SUGGESTION_ACTIONS = [
  'rewrite',
  'add-eld',
  'fix',
  'simplify',
  'add-support-table',
  'add-sample-response',
  'add-pulse-check',
] as const;
export type AiSuggestionAction = (typeof AI_SUGGESTION_ACTIONS)[number];

export const AI_SUGGESTION_LABELS: Record<AiSuggestionAction, string> = {
  rewrite: 'Rewrite with instruction',
  'add-eld': 'Add ELD support',
  fix: 'Fix with AI',
  simplify: 'Simplify for reading level',
  'add-support-table': 'Add an Additional Support table',
  'add-sample-response': 'Write a sample student response',
  'add-pulse-check': 'Add a Pulse Check',
};

/** Rewrite takes the Editor's instruction; Fix takes the failing check's message. */
export function needsInstruction(action: AiSuggestionAction): boolean {
  return action === 'rewrite' || action === 'fix';
}

/** An action named by the browser, or undefined if it is not one. */
export function parseAiSuggestionAction(value: unknown): AiSuggestionAction | undefined {
  return (AI_SUGGESTION_ACTIONS as readonly unknown[]).includes(value) ? (value as AiSuggestionAction) : undefined;
}

/** What the person who asked does with an AI Suggestion. */
export type SuggestionDecision = 'accepted' | 'rejected';
