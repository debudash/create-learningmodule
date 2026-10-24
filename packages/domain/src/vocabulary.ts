/** Workflow states of a Lesson (see GLOSSARY: Workflow). */
export const LESSON_STATUSES = [
  'outlined',
  'queued',
  'generating',
  'generation-failed',
  'draft',
  'in-review',
  'changes-requested',
  'approved',
] as const;

export type LessonStatus = (typeof LESSON_STATUSES)[number];

export const LESSON_STATUS_LABELS: Record<LessonStatus, string> = {
  outlined: 'Outlined',
  queued: 'Queued',
  generating: 'Generating',
  'generation-failed': 'Generation Failed',
  draft: 'Draft',
  'in-review': 'In Review',
  'changes-requested': 'Changes Requested',
  approved: 'Approved',
};

export const ROLES = ['editor', 'approver'] as const;
export type Role = (typeof ROLES)[number];

/** Why a Lesson Version was captured. */
export const VERSION_REASONS = [
  'generated',
  'regenerated',
  /** The content a Regenerate is about to replace. */
  'replaced',
  'submitted',
  'approved',
  'published',
  'restored',
] as const;
export type VersionReason = (typeof VERSION_REASONS)[number];
