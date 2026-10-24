import { hasStandard, normalizeCode } from '@lcg/standards';
import { FRAMEWORK_OF } from './cells.js';
import type {
  ConfirmResult,
  ImportProposal,
  OutlineIssue,
  OutlineLesson,
  Resolution,
  ResolvedIssue,
  StandardRef,
} from './types.js';

/**
 * Applies an Editor's resolutions to an import proposal. Succeeds only when
 * every Blocking issue has a valid resolution; unresolved Warnings are kept
 * as written (and recorded as accepted by default).
 */
export function confirmImport(proposal: ImportProposal, resolutions: Resolution[]): ConfirmResult {
  const issuesById = new Map(proposal.issues.map((i) => [i.id, i]));
  const lessons: OutlineLesson[] = structuredClone(proposal.lessons);
  const errors: string[] = [];
  const resolved = new Map<string, ResolvedIssue>();

  for (const resolution of resolutions) {
    const issue = issuesById.get(resolution.issueId);
    if (!issue) {
      errors.push(`No issue "${resolution.issueId}" in this Outline.`);
      continue;
    }
    const outcome = applyResolution(issue, resolution, lessons);
    if ('error' in outcome) errors.push(outcome.error);
    else resolved.set(issue.id, outcome.resolved);
  }

  const unresolved = proposal.issues.filter((i) => i.severity === 'blocking' && !resolved.has(i.id));
  if (errors.length > 0 || unresolved.length > 0) return { ok: false, unresolved, errors };

  for (const lesson of lessons) dedupeStandards(lesson);

  return {
    ok: true,
    confirmed: {
      unit: structuredClone(proposal.unit),
      arcs: structuredClone(proposal.arcs),
      lessons,
      issues: proposal.issues.map(
        (i) => resolved.get(i.id) ?? { ...i, resolution: 'accepted-by-default' as const },
      ),
    },
  };
}

type Outcome = { resolved: ResolvedIssue } | { error: string };

function applyResolution(issue: OutlineIssue, resolution: Resolution, lessons: OutlineLesson[]): Outcome {
  if (resolution.action === 'accept') {
    return issue.severity === 'blocking'
      ? { error: `${issue.id} is Blocking and cannot be kept as written.` }
      : { resolved: { ...issue, resolution: 'accept' } };
  }

  const lesson = lessons.find((l) => l.key === issue.lessonKey);
  const field = issue.field;
  if (!lesson || !field) {
    return { error: `${issue.id} can only be accepted; it does not refer to a standard.` };
  }
  const refs: StandardRef[] = lesson[field];
  const index = refs.findIndex((r) =>
    field === 'eldStandards' ? r.raw === issue.raw : r.code === issue.code,
  );
  if (index < 0) return { error: `${issue.id} no longer matches an entry in ${issue.lessonKey}.` };

  if (resolution.action === 'remove') {
    refs.splice(index, 1);
    return { resolved: { ...issue, resolution: 'remove' } };
  }

  const value = resolution.action === 'accept-suggestion' ? issue.suggestion : resolution.value;
  if (!value) return { error: `${issue.id} has no suggestion to accept.` };
  const normalized = normalizeCode(value, FRAMEWORK_OF[field]);
  if (!normalized.ok || !hasStandard(normalized.code)) {
    return { error: `"${value}" is not a valid standard for ${issue.id}.` };
  }
  refs[index] = { ...refs[index]!, code: normalized.code };
  return { resolved: { ...issue, resolution: resolution.action, resolvedValue: normalized.code } };
}

function dedupeStandards(lesson: OutlineLesson): void {
  const unique = <T extends StandardRef>(refs: T[]) =>
    refs.filter((r, i) => refs.findIndex((o) => o.code === r.code) === i);
  lesson.focusStandards = unique(lesson.focusStandards);
  lesson.supportingStandards = unique(lesson.supportingStandards);
  lesson.mediaLiteracyStandards = unique(lesson.mediaLiteracyStandards);
}
