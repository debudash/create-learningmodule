import type { CheckCounts, CheckOutcome } from '@lcg/domain';

/** Badge colours for a Quality Check outcome, shared by the board and the Checks tab. */
export const OUTCOME_BADGE: Record<CheckOutcome, string> = {
  pass: 'bg-support-soft text-support',
  warn: 'bg-eld-soft text-eld',
  fail: 'bg-danger-soft text-danger',
};

/** The words for a Lesson's check counts: "2 failing · 1 to check · 9 passing". */
export function describeCounts(counts: CheckCounts): string {
  return `${counts.fail} failing · ${counts.warn} to check · ${counts.pass} passing`;
}

/** A Lesson's checks at a glance: its worst outcome, and how many share it. */
export function CheckBadge({ counts }: { counts: CheckCounts }) {
  if (counts.fail + counts.warn + counts.pass === 0) return null;
  const [outcome, label]: [CheckOutcome, string] =
    counts.fail > 0
      ? ['fail', `${counts.fail} failing`]
      : counts.warn > 0
        ? ['warn', `${counts.warn} to check`]
        : ['pass', 'Checks pass'];
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${OUTCOME_BADGE[outcome]}`} title={`Quality Checks: ${describeCounts(counts)}`}>
      {label}
    </span>
  );
}
