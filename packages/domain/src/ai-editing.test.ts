import { describe, expect, it } from 'vitest';
import { AI_EDIT_ACTIONS, AI_EDIT_LABELS, mayUseAiTools, needsInstruction, parseAiEditAction } from './ai-editing.js';

describe('AI editing', () => {
  it('lists the actions in build order, each with a label', () => {
    expect(AI_EDIT_ACTIONS).toEqual([
      'rewrite',
      'add-eld',
      'fix',
      'simplify',
      'add-support-table',
      'add-sample-response',
      'add-pulse-check',
    ]);
    for (const action of AI_EDIT_ACTIONS) expect(AI_EDIT_LABELS[action]).toBeTruthy();
  });

  it('asks for an instruction only where the person supplies the goal', () => {
    expect(AI_EDIT_ACTIONS.filter(needsInstruction)).toEqual(['rewrite', 'fix']);
  });

  it('keeps AI tools off Lessons that cannot be edited', () => {
    expect(mayUseAiTools('draft')).toBe(true);
    expect(mayUseAiTools('changes-requested')).toBe(true);
    expect(mayUseAiTools('in-review')).toBe(true);
    expect(mayUseAiTools('approved')).toBe(false);
    expect(mayUseAiTools('generating')).toBe(false);
  });

  it('accepts only known actions from the browser', () => {
    expect(parseAiEditAction('add-eld')).toBe('add-eld');
    expect(parseAiEditAction('delete-everything')).toBeUndefined();
  });
});
