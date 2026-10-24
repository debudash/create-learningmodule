import type { OutlineIssue, OutlineIssueKind, OutlineIssueSeverity, Resolution } from './types.js';

/** A resolution without the issue it applies to, e.g. to apply to a whole group. */
export type ResolutionChoice = WithoutIssueId<Resolution>;
type WithoutIssueId<R> = R extends unknown ? Omit<R, 'issueId'> : never;

/** Outline Issues that are the same problem repeated across Lessons. */
export interface IssueGroup {
  key: string;
  severity: OutlineIssueSeverity;
  kind: OutlineIssueKind;
  message: string;
  code?: string;
  raw?: string;
  suggestion?: string;
  /** In Outline order. */
  issues: OutlineIssue[];
}

/**
 * Groups identical Outline Issues (same kind, code and Outline text, e.g. the
 * same ELD code with the same description in several Lessons) so one decision
 * can be applied to all of them. Blocking groups come first, then Warnings, each
 * in Outline order. Unit-level issues are never grouped.
 */
export function groupIssues(issues: OutlineIssue[]): IssueGroup[] {
  const groups = new Map<string, IssueGroup>();
  for (const issue of issues) {
    const key = issue.lessonKey
      ? [
          issue.severity,
          issue.kind,
          issue.code ?? '',
          issue.raw ?? '',
          issue.suggestion ?? '',
        ].join('|')
      : `unit|${issue.id}`;
    const group = groups.get(key);
    if (group) group.issues.push(issue);
    else {
      groups.set(key, {
        key,
        severity: issue.severity,
        kind: issue.kind,
        message: issue.message,
        code: issue.code,
        raw: issue.raw,
        suggestion: issue.suggestion,
        issues: [issue],
      });
    }
  }
  const all = [...groups.values()];
  return [
    ...all.filter((g) => g.severity === 'blocking'),
    ...all.filter((g) => g.severity === 'warning'),
  ];
}

/** The resolutions confirmImport accepts for an issue, in the order to offer them. */
export function resolutionOptions(issue: OutlineIssue): Resolution['action'][] {
  if (issue.kind === 'unknown-lesson-type') return ['replace'];
  const keep: Resolution['action'][] = issue.severity === 'warning' ? ['accept'] : [];
  if (!issue.lessonKey || !issue.field) return keep;
  return [
    ...(issue.suggestion ? (['accept-suggestion'] as const) : []),
    'replace',
    'remove',
    ...keep,
  ];
}

/** Blocking issues that still lack a usable resolution; import waits until there are none. */
export function unresolvedBlocking(
  issues: OutlineIssue[],
  resolutions: Resolution[],
): OutlineIssue[] {
  const byId = new Map(resolutions.map((r) => [r.issueId, r]));
  return issues.filter((issue) => {
    if (issue.severity !== 'blocking') return false;
    const resolution = byId.get(issue.id);
    if (!resolution || !resolutionOptions(issue).includes(resolution.action)) return true;
    return resolution.action === 'replace' && !resolution.value.trim();
  });
}

/** Gives every issue in a group the same resolution, replacing any each already had. */
export function applyToGroup(
  resolutions: Resolution[],
  group: IssueGroup,
  choice: ResolutionChoice,
): Resolution[] {
  const ids = new Set(group.issues.map((i) => i.id));
  return [
    ...resolutions.filter((r) => !ids.has(r.issueId)),
    ...group.issues.map((i) => ({ ...choice, issueId: i.id }) as Resolution),
  ];
}
