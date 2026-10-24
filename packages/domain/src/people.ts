import type { Actor } from './workflow.js';
import type { VersionReason } from './vocabulary.js';

type Person = Extract<Actor, { kind: 'user' }>;

/**
 * Who may set a Lesson's Assignee: anyone may claim a Lesson for themselves or
 * unclaim their own; an Approver may also assign it to someone else or clear it.
 */
export function mayAssign(actor: Person, assigneeId: string | null, currentAssigneeId: string | null): boolean {
  if (actor.role === 'approver') return true;
  if (assigneeId === actor.id) return true;
  return assigneeId === null && currentAssigneeId === actor.id;
}

/** Only Approvers publish Units. */
export function mayPublish(actor: Person): boolean {
  return actor.role === 'approver';
}

/** Whether this person approving the Lesson would be a Self-Approval (they edited it). */
export function isSelfApproval(actor: Actor, editorIds: readonly string[]): boolean {
  return actor.kind === 'user' && actor.role === 'approver' && editorIds.includes(actor.id);
}

export const VERSION_REASON_LABELS: Record<VersionReason, string> = {
  generated: 'Generated',
  regenerated: 'Regenerated',
  replaced: 'Before regenerating',
  submitted: 'Submitted',
  approved: 'Approved',
  published: 'Published',
  restored: 'Restored',
};
