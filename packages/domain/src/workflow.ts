import { LESSON_STATUS_LABELS, type LessonStatus, type Role } from './vocabulary.js';

/** Who is acting: a signed-in person, or the system (the generation worker). */
export type Actor = { kind: 'user'; id: string; role: Role } | { kind: 'system' };

/** Everything that can happen to a Lesson's workflow status. */
export type LessonAction =
  /** Start (or retry) generation. */
  | { type: 'queue' }
  | { type: 'cancel' }
  | { type: 'start-generating' }
  | { type: 'finish-generating' }
  | { type: 'fail-generating'; reason: string }
  | { type: 'regenerate'; instructions?: string }
  | { type: 'submit' }
  | { type: 'approve' }
  | { type: 'request-changes'; reason: string }
  | { type: 'reopen'; reason: string };

export type LessonActionType = LessonAction['type'];

/** Who may take each action. */
type Performer = 'system' | 'anyone' | 'approver';

interface Rule {
  from: readonly LessonStatus[];
  to: LessonStatus;
  by: Performer;
  needsReason?: boolean;
}

const RULES: Record<LessonActionType, Rule> = {
  queue: { from: ['outlined', 'generation-failed'], to: 'queued', by: 'anyone' },
  cancel: { from: ['queued'], to: 'outlined', by: 'anyone' },
  'start-generating': { from: ['queued'], to: 'generating', by: 'system' },
  'finish-generating': { from: ['generating'], to: 'draft', by: 'system' },
  'fail-generating': { from: ['generating'], to: 'generation-failed', by: 'system' },
  regenerate: { from: ['draft', 'changes-requested'], to: 'queued', by: 'anyone' },
  submit: { from: ['draft', 'changes-requested'], to: 'in-review', by: 'anyone' },
  approve: { from: ['in-review'], to: 'approved', by: 'approver' },
  'request-changes': { from: ['in-review'], to: 'changes-requested', by: 'approver', needsReason: true },
  reopen: { from: ['approved'], to: 'in-review', by: 'approver', needsReason: true },
};

/** Facts about the Lesson the decision needs beyond its status. */
export interface DecisionContext {
  /** People who edited the Lesson since it was last generated. */
  editorIds: readonly string[];
  /** Quality Checks currently failing. */
  failingChecks: number;
}

export type Refusal = 'wrong-status' | 'not-permitted' | 'reason-required';

export type Decision =
  | { ok: true; to: LessonStatus; flags: { selfApproval: boolean; overFailingChecks: boolean } }
  | { ok: false; refusal: Refusal; message: string };

const ACTION_WORDS: Record<LessonActionType, string> = {
  queue: 'generated',
  cancel: 'taken out of the generation queue',
  'start-generating': 'started generating',
  'finish-generating': 'finished generating',
  'fail-generating': 'marked as failed',
  regenerate: 'regenerated',
  submit: 'submitted for review',
  approve: 'approved',
  'request-changes': 'sent back with changes requested',
  reopen: 'reopened',
};

/**
 * The Lesson workflow (PRD "Lesson workflow"): whether `actor` may take `action`
 * on a Lesson in `status`, and if so the new status and what the change records.
 */
export function decide(status: LessonStatus, actor: Actor, action: LessonAction, context: DecisionContext): Decision {
  const rule = RULES[action.type];
  const refuse = (refusal: Refusal, message: string): Decision => ({ ok: false, refusal, message });

  if (!permits(rule.by, actor)) {
    return refuse(
      'not-permitted',
      rule.by === 'approver'
        ? `Only an Approver can do this; Lessons are ${ACTION_WORDS[action.type]} by Approvers.`
        : rule.by === 'system'
          ? 'Only the generation worker does this.'
          : 'The generation worker cannot do this.',
    );
  }
  if (!rule.from.includes(status)) {
    return refuse(
      'wrong-status',
      `A Lesson that is ${LESSON_STATUS_LABELS[status]} cannot be ${ACTION_WORDS[action.type]}.`,
    );
  }
  if (rule.needsReason && !('reason' in action && action.reason.trim())) {
    return refuse('reason-required', 'Say why, so the Editors know what to change.');
  }

  const approving = action.type === 'approve' && actor.kind === 'user';
  return {
    ok: true,
    to: rule.to,
    flags: {
      selfApproval: approving && context.editorIds.includes(actor.id),
      overFailingChecks: approving && context.failingChecks > 0,
    },
  };
}

function permits(by: Performer, actor: Actor): boolean {
  if (by === 'system') return actor.kind === 'system';
  if (actor.kind === 'system') return false;
  return by === 'anyone' || actor.role === 'approver';
}

/** The actions a person could take on a Lesson in this status, for showing the right buttons. */
export function availableActions(status: LessonStatus, actor: Actor): LessonActionType[] {
  return (Object.keys(RULES) as LessonActionType[]).filter(
    (type) => RULES[type].from.includes(status) && permits(RULES[type].by, actor),
  );
}

/** The actions a person takes from the Lesson workspace's review buttons. */
export type ReviewAction = Extract<LessonAction, { type: 'submit' | 'approve' | 'request-changes' | 'reopen' }>;

/**
 * Reads a review action from untrusted input (a browser request), or returns
 * undefined if it is not one.
 *
 * LCG-15: the review server action passed the browser's action object straight to
 * the workflow, so a crafted { type: 'regenerate' } moved a Lesson to Queued with
 * no job and skipped the generation limits. Only the four review actions, with a
 * text reason where one is needed, are accepted now.
 */
export function parseReviewAction(input: unknown): ReviewAction | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const { type, reason } = input as { type?: unknown; reason?: unknown };
  if (type === 'submit' || type === 'approve') return { type };
  if ((type === 'request-changes' || type === 'reopen') && typeof reason === 'string') return { type, reason };
  return undefined;
}
