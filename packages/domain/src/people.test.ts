import { describe, expect, it } from 'vitest';
import { isSelfApproval, mayAssign, mayPublish } from './people.js';

const editor = { kind: 'user' as const, id: 'e1', role: 'editor' as const };
const approver = { kind: 'user' as const, id: 'a1', role: 'approver' as const };

describe('mayAssign', () => {
  it('lets anyone claim a Lesson or unclaim their own', () => {
    expect(mayAssign(editor, 'e1', null)).toBe(true);
    expect(mayAssign(editor, 'e1', 'e2')).toBe(true);
    expect(mayAssign(editor, null, 'e1')).toBe(true);
  });

  it('keeps assigning others and clearing their claims to Approvers', () => {
    expect(mayAssign(editor, 'e2', null)).toBe(false);
    expect(mayAssign(editor, null, 'e2')).toBe(false);
    expect(mayAssign(approver, 'e2', 'e1')).toBe(true);
    expect(mayAssign(approver, null, 'e1')).toBe(true);
  });
});

describe('mayPublish and isSelfApproval', () => {
  it('keeps publishing to Approvers', () => {
    expect(mayPublish(approver)).toBe(true);
    expect(mayPublish(editor)).toBe(false);
  });

  it('calls it Self-Approval only for an Approver who edited the Lesson', () => {
    expect(isSelfApproval(approver, ['a1'])).toBe(true);
    expect(isSelfApproval(approver, ['e1'])).toBe(false);
    expect(isSelfApproval(editor, ['e1'])).toBe(false);
  });
});
