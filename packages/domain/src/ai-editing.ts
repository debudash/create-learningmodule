import { isEditable } from './editing.js';
import type { LessonStatus } from './vocabulary.js';

/**
 * What an Editor can ask the AI to do to one Activity (PRD stories 118-121), in
 * build order. Every result is an AI Suggestion the Editor accepts or rejects.
 */
export const AI_EDIT_ACTIONS = [
  'rewrite',
  'add-eld',
  'fix',
  'simplify',
  'add-support-table',
  'add-sample-response',
  'add-pulse-check',
] as const;
export type AiEditAction = (typeof AI_EDIT_ACTIONS)[number];

export const AI_EDIT_LABELS: Record<AiEditAction, string> = {
  rewrite: 'Rewrite with instruction',
  'add-eld': 'Add ELD support',
  fix: 'Fix with AI',
  simplify: 'Simplify for reading level',
  'add-support-table': 'Add an Additional Support table',
  'add-sample-response': 'Write a sample student response',
  'add-pulse-check': 'Add a Pulse Check',
};

/** Rewrite takes the Editor's instruction; Fix takes the failing check's message. */
export function needsInstruction(action: AiEditAction): boolean {
  return action === 'rewrite' || action === 'fix';
}

/** AI tools follow editing: never on Approved Lessons, or while a Lesson is being generated (story 125). */
export function mayUseAiTools(status: LessonStatus): boolean {
  return isEditable(status);
}

/** An action named by the browser, or undefined if it is not one. */
export function parseAiEditAction(value: unknown): AiEditAction | undefined {
  return (AI_EDIT_ACTIONS as readonly unknown[]).includes(value) ? (value as AiEditAction) : undefined;
}
