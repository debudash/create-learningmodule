import { LESSON_STATUS_LABELS, type LessonStatus } from '@lcg/domain';

const TONE: Record<LessonStatus, string> = {
  outlined: 'bg-paper-sunk text-ink-soft',
  queued: 'bg-paper-sunk text-ink-soft',
  generating: 'bg-accent-soft text-accent',
  'generation-failed': 'bg-danger-soft text-danger',
  draft: 'bg-eld-soft text-eld',
  'in-review': 'bg-teacher-soft text-teacher',
  'changes-requested': 'bg-danger-soft text-danger',
  approved: 'bg-support-soft text-support',
};

export function StatusBadge({ status }: { status: LessonStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TONE[status]}`}>
      {LESSON_STATUS_LABELS[status]}
    </span>
  );
}
