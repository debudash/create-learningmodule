import { describe, expect, it } from 'vitest';
import { AI_SUGGESTION_ACTIONS, AI_SUGGESTION_LABELS, needsInstruction, parseAiSuggestionAction } from './ai-suggestions.js';

describe('AI Suggestions', () => {
  it('lists the actions in build order, each with a label', () => {
    expect(AI_SUGGESTION_ACTIONS).toEqual([
      'rewrite',
      'add-eld',
      'fix',
      'simplify',
      'add-support-table',
      'add-sample-response',
      'add-pulse-check',
    ]);
    for (const action of AI_SUGGESTION_ACTIONS) expect(AI_SUGGESTION_LABELS[action]).toBeTruthy();
  });

  it('asks for an instruction only where the person supplies the goal', () => {
    expect(AI_SUGGESTION_ACTIONS.filter(needsInstruction)).toEqual(['rewrite', 'fix']);
  });

  it('accepts only known actions from the browser', () => {
    expect(parseAiSuggestionAction('add-eld')).toBe('add-eld');
    expect(parseAiSuggestionAction('delete-everything')).toBeUndefined();
  });
});
