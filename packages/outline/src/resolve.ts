import { LESSON_TYPES, type LessonType } from '@lcg/lesson-schema';
import { hasStandard, normalizeCode } from '@lcg/standards';
import { FRAMEWORK_OF } from './cells.js';
import type {
  ConfirmResult,
  ImportProposal,
  OutlineIssue,
  OutlineLesson,
  Resolution,
  OutlineUnit,
  ResolvedIssue,
  StandardRef,
  UnitEdits,
} from './types.js';

/**
 * Applies an Editor's resolutions and Unit edits to an import proposal. Succeeds
 * only when every Blocking issue has a valid resolution and the Unit's metadata
 * is complete; unresolved Warnings are kept as written (recorded as accepted by
 * default).
 */
export function confirmImport(
  proposal: ImportProposal,
  resolutions: Resolution[],
  unitEdits: UnitEdits = {},
): ConfirmResult {
  const issuesById = new Map(proposal.issues.map((i) => [i.id, i]));
  const lessons: OutlineLesson[] = structuredClone(proposal.lessons);
  const unit = applyUnitEdits(proposal.unit, unitEdits);
  const errors: string[] = unitProblems(unit);
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
      unit,
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

  // LCG-1: an unknown Lesson Type is Blocking but names no standards field, so the
  // field-based resolution below refused every action and confirm could never
  // succeed. It is resolved by replacing it with a valid Lesson Type instead.
  if (issue.kind === 'unknown-lesson-type' && lesson) {
    const value = resolution.action === 'replace' ? resolution.value : undefined;
    if (!isLessonType(value)) {
      return { error: `${issue.id} needs one of these Lesson Types: ${LESSON_TYPES.join(', ')}.` };
    }
    lesson.lessonType = value;
    return { resolved: { ...issue, resolution: 'replace', resolvedValue: value } };
  }

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

function applyUnitEdits(unit: OutlineUnit, edits: UnitEdits): OutlineUnit {
  const { anchorText, ...rest } = edits;
  return {
    ...structuredClone(unit),
    ...rest,
    anchorText: { ...unit.anchorText, ...anchorText },
  };
}

function unitProblems(unit: OutlineUnit): string[] {
  const problems: string[] = [];
  if (!Number.isInteger(unit.grade) || unit.grade < 1 || unit.grade > 12) problems.push('The Unit needs a grade from 1 to 12.');
  if (!Number.isInteger(unit.unitNumber) || unit.unitNumber < 1) problems.push('The Unit needs a unit number.');
  if (!unit.anchorText.title.trim() || unit.anchorText.title === 'Untitled') problems.push('The Unit needs an anchor text title.');
  if (!unit.title.trim()) problems.push('The Unit needs a title.');
  return problems;
}

function isLessonType(value: string | undefined): value is LessonType {
  return (LESSON_TYPES as readonly string[]).includes(value ?? '');
}

function dedupeStandards(lesson: OutlineLesson): void {
  const unique = <T extends StandardRef>(refs: T[]) =>
    refs.filter((r, i) => refs.findIndex((o) => o.code === r.code) === i);
  lesson.focusStandards = unique(lesson.focusStandards);
  lesson.supportingStandards = unique(lesson.supportingStandards);
  lesson.mediaLiteracyStandards = unique(lesson.mediaLiteracyStandards);
}
