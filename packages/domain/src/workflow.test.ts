import { describe, expect, it } from 'vitest';
import type { LessonStatus } from './vocabulary.js';
import { decide, type Actor, type LessonAction } from './workflow.js';

const editor: Actor = { kind: 'user', id: 'e1', role: 'editor' };
const approver: Actor = { kind: 'user', id: 'a1', role: 'approver' };
const system: Actor = { kind: 'system' };
const clean = { editorIds: [] as string[], failingChecks: 0 };

const to = (status: LessonStatus, actor: Actor, action: LessonAction, context = clean) => {
  const result = decide(status, actor, action, context);
  return result.ok ? result.to : result.refusal;
};

describe('decide: allowed transitions', () => {
  it.each<[LessonStatus, Actor, LessonAction, LessonStatus]>([
    ['outlined', editor, { type: 'queue' }, 'queued'],
    ['generation-failed', editor, { type: 'queue' }, 'queued'],
    ['queued', editor, { type: 'cancel' }, 'outlined'],
    ['queued', system, { type: 'start-generating' }, 'generating'],
    ['generating', system, { type: 'finish-generating' }, 'draft'],
    ['generating', system, { type: 'fail-generating', reason: 'model timed out' }, 'generation-failed'],
    ['draft', editor, { type: 'regenerate' }, 'queued'],
    ['changes-requested', approver, { type: 'regenerate', instructions: 'shorter Launch' }, 'queued'],
    ['draft', editor, { type: 'submit' }, 'in-review'],
    ['changes-requested', editor, { type: 'submit' }, 'in-review'],
    ['in-review', approver, { type: 'approve' }, 'approved'],
    ['in-review', approver, { type: 'request-changes', reason: 'Pulse Check 2 is ambiguous' }, 'changes-requested'],
    ['approved', approver, { type: 'reopen', reason: 'Typo in Look Back' }, 'in-review'],
  ])('%s + %o: %o → %s', (from, actor, action, expected) => {
    expect(to(from, actor, action)).toBe(expected);
  });
});

describe('decide: refusals', () => {
  it('refuses actions that do not apply to the current status', () => {
    expect(to('draft', approver, { type: 'approve' })).toBe('wrong-status');
    expect(to('approved', editor, { type: 'submit' })).toBe('wrong-status');
    expect(to('in-review', editor, { type: 'regenerate' })).toBe('wrong-status');
    expect(to('approved', editor, { type: 'regenerate' })).toBe('wrong-status');
    expect(to('outlined', editor, { type: 'submit' })).toBe('wrong-status');
  });

  it('keeps sign-off to Approvers', () => {
    expect(to('in-review', editor, { type: 'approve' })).toBe('not-permitted');
    expect(to('in-review', editor, { type: 'request-changes', reason: 'x' })).toBe('not-permitted');
    expect(to('approved', editor, { type: 'reopen', reason: 'x' })).toBe('not-permitted');
  });

  it('keeps generation steps to the system, and user steps to people', () => {
    expect(to('queued', editor, { type: 'start-generating' })).toBe('not-permitted');
    expect(to('generating', approver, { type: 'finish-generating' })).toBe('not-permitted');
    expect(to('draft', system, { type: 'submit' })).toBe('not-permitted');
  });

  it('requires a reason to request changes or Reopen', () => {
    expect(to('in-review', approver, { type: 'request-changes', reason: '  ' })).toBe('reason-required');
    expect(to('approved', approver, { type: 'reopen', reason: '' })).toBe('reason-required');
  });

  it('explains every refusal in words', () => {
    const result = decide('draft', approver, { type: 'approve' }, clean);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/Draft/);
  });
});

describe('decide: what an approval records', () => {
  it('flags Self-Approval when the Approver edited the Lesson', () => {
    const result = decide('in-review', approver, { type: 'approve' }, { editorIds: ['e1', 'a1'], failingChecks: 0 });
    expect(result).toMatchObject({ ok: true, flags: { selfApproval: true, overFailingChecks: false } });
  });

  it('flags approval over failing Quality Checks but still allows it', () => {
    const result = decide('in-review', approver, { type: 'approve' }, { editorIds: [], failingChecks: 2 });
    expect(result).toMatchObject({ ok: true, to: 'approved', flags: { selfApproval: false, overFailingChecks: true } });
  });

  it('does not flag other transitions', () => {
    const result = decide('draft', editor, { type: 'submit' }, { editorIds: ['e1'], failingChecks: 3 });
    expect(result).toMatchObject({ ok: true, flags: { selfApproval: false, overFailingChecks: false } });
  });
});
