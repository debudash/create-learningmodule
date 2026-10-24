import type { LessonStatus } from './vocabulary.js';

/** States in which a Lesson's content may be edited. Approved Lessons are read-only until Reopened. */
export const EDITABLE_STATUSES: ReadonlySet<LessonStatus> = new Set(['draft', 'in-review', 'changes-requested']);

export function isEditable(status: LessonStatus): boolean {
  return EDITABLE_STATUSES.has(status);
}
