import {
  LESSON_MINUTES,
  LESSON_TYPE_LABELS,
  lessonMinutes,
  sectionMinutes,
  studentView,
  targetMinutes,
  TEACHER_ONLY_BLOCKS,
  type Lesson,
  type LessonType,
} from '@lcg/lesson-schema';

export type CheckOutcome = 'pass' | 'warn' | 'fail';

/** One Quality Check result (GLOSSARY: Quality Check). */
export interface QualityCheckResult {
  checkId: string;
  source: 'rule' | 'ai-review';
  outcome: CheckOutcome;
  message: string;
  /** The Activity the result points at, when it points at one. */
  location?: string;
}

/** What the rule checks need from the Lesson's Outline row. */
export interface CheckOutlineFacts {
  focusStandards: string[];
  vocabulary: string[];
}

/** People-facing names of the checks. */
export const CHECK_LABELS: Record<string, string> = {
  pacing: 'Lesson pacing',
  'section-pacing': 'Section pacing',
  'focus-standards-taught': 'Focus Standards taught',
  'known-standards': 'Standard tags',
  vocabulary: 'Outline vocabulary',
  'pulse-check': 'Pulse Check',
  'eld-support': 'ELD support',
  'student-view': 'Student View',
  'ai-standard': 'AI Review: standard',
  'ai-anchor-text': 'AI Review: anchor text',
};

/** Minutes a whole Lesson may run off 50 before pacing fails rather than warns. */
const PACING_TOLERANCE = 5;

/** Lesson Types whose Lessons must include a Pulse Check (Writing and Flex Day Lessons rarely do). */
const NEEDS_PULSE_CHECK: ReadonlySet<LessonType> = new Set(['core-reading']);

const rule = (checkId: string, outcome: CheckOutcome, message: string, location?: string): QualityCheckResult => ({
  checkId,
  source: 'rule',
  outcome,
  message,
  ...(location ? { location } : {}),
});

/**
 * The Rule-Based Quality Checks (PRD stories 104-112): structure, pacing, standards
 * tagging, vocabulary, Pulse Checks, ELD support and the Student View. Pure, so they
 * run in the browser as people edit and on the server whenever a Lesson is stored.
 */
export function runRuleChecks(lesson: Lesson, outline: CheckOutlineFacts): QualityCheckResult[] {
  return [
    ...pacing(lesson),
    ...sectionPacing(lesson),
    ...focusStandardsTaught(lesson, outline),
    ...knownStandards(lesson),
    ...vocabulary(lesson, outline),
    ...pulseCheck(lesson),
    ...eldSupport(lesson),
    ...studentViewClean(lesson),
  ];
}

function pacing(lesson: Lesson): QualityCheckResult[] {
  const minutes = lessonMinutes(lesson);
  const off = Math.abs(minutes - LESSON_MINUTES);
  if (off === 0) return [rule('pacing', 'pass', `The Lesson runs ${LESSON_MINUTES} minutes.`)];
  return [
    rule(
      'pacing',
      off > PACING_TOLERANCE ? 'fail' : 'warn',
      `The Lesson runs ${minutes} minutes; it should be ${LESSON_MINUTES}.`,
    ),
  ];
}

function sectionPacing(lesson: Lesson): QualityCheckResult[] {
  const results = lesson.sections.flatMap((section) => {
    const target = targetMinutes(lesson.lessonType, section.kind);
    const minutes = sectionMinutes(section);
    if (target === undefined || minutes === target) return [];
    return [
      rule(
        'section-pacing',
        'warn',
        `${section.title} runs ${minutes} minutes; ${LESSON_TYPE_LABELS[lesson.lessonType]} Lessons give it ${target}.`,
      ),
    ];
  });
  return results.length > 0 ? results : [rule('section-pacing', 'pass', 'Every Section is on its target.')];
}

function focusStandardsTaught(lesson: Lesson, outline: CheckOutlineFacts): QualityCheckResult[] {
  const tagged = new Set(lesson.sections.flatMap((s) => s.activities.flatMap((a) => a.standards)));
  const missing = outline.focusStandards.filter((code) => !tagged.has(code));
  if (missing.length === 0) return [rule('focus-standards-taught', 'pass', 'Every Focus Standard is taught by an Activity.')];
  return missing.map((code) => rule('focus-standards-taught', 'fail', `No Activity is tagged with the Focus Standard ${code}.`));
}

function knownStandards(lesson: Lesson): QualityCheckResult[] {
  const { header } = lesson;
  const known = new Set([
    ...header.focusStandards,
    ...header.supportingStandards,
    ...header.eldStandards,
    ...header.mediaLiteracyStandards,
  ]);
  const results = lesson.sections.flatMap((section) =>
    section.activities.flatMap((activity) => {
      const unknown = activity.standards.filter((code) => !known.has(code));
      return unknown.length > 0
        ? [
            rule(
              'known-standards',
              'warn',
              `${activity.title} is tagged with ${unknown.join(', ')}, which ${unknown.length === 1 ? 'is' : 'are'} not among this Lesson's standards.`,
              activity.id,
            ),
          ]
        : [];
    }),
  );
  return results.length > 0 ? results : [rule('known-standards', 'pass', "Every tag is one of the Lesson's standards.")];
}

function vocabulary(lesson: Lesson, outline: CheckOutlineFacts): QualityCheckResult[] {
  const defined = new Set(lesson.header.vocabulary.map((v) => v.word.toLowerCase().replace(/[()]/g, '')));
  const missing = outline.vocabulary.filter((word) => !defined.has(word.toLowerCase().replace(/[()]/g, '')));
  if (missing.length === 0) return [rule('vocabulary', 'pass', 'Every Outline vocabulary word is defined.')];
  return [rule('vocabulary', 'warn', `The Outline's vocabulary is not all defined: ${missing.join(', ')}.`)];
}

function pulseCheck(lesson: Lesson): QualityCheckResult[] {
  if (!NEEDS_PULSE_CHECK.has(lesson.lessonType)) return [rule('pulse-check', 'pass', 'This Lesson Type needs no Pulse Check.')];
  const has = lesson.sections.some((s) => s.activities.some((a) => a.blocks.some((b) => b.type === 'pulse-check')));
  return has
    ? [rule('pulse-check', 'pass', 'The Lesson checks understanding with a Pulse Check.')]
    : [rule('pulse-check', 'fail', `${LESSON_TYPE_LABELS[lesson.lessonType]} Lessons need at least one Pulse Check.`)];
}

function eldSupport(lesson: Lesson): QualityCheckResult[] {
  const learning = lesson.sections.filter((s) => s.kind === 'learning-in-action');
  return learning.flatMap((section) =>
    section.activities.map((activity) =>
      activity.blocks.some((b) => b.type === 'eld-panel')
        ? rule('eld-support', 'pass', `${activity.title} has Integrated ELD Instructions.`, activity.id)
        : rule('eld-support', 'warn', `${activity.title} has no Integrated ELD Instructions.`, activity.id),
    ),
  );
}

function studentViewClean(lesson: Lesson): QualityCheckResult[] {
  const visible = JSON.stringify(studentView(lesson));
  const teacherTexts = lesson.sections.flatMap((s) =>
    s.activities.flatMap((a) =>
      a.blocks.flatMap((b) => (TEACHER_ONLY_BLOCKS.has(b.type) && 'text' in b && b.text.length > 20 ? [b.text] : [])),
    ),
  );
  const leaked = teacherTexts.find((text) => visible.includes(JSON.stringify(text).slice(1, -1)));
  return leaked
    ? [rule('student-view', 'fail', 'Teacher-only material appears in the Student View.')]
    : [rule('student-view', 'pass', 'The Student View holds no teacher-only material.')];
}

export interface CheckSummary {
  pass: number;
  warn: number;
  fail: number;
  worst: CheckOutcome;
}

export function summarizeChecks(results: readonly { outcome: CheckOutcome }[]): CheckSummary {
  const count = (outcome: CheckOutcome) => results.filter((r) => r.outcome === outcome).length;
  const summary = { pass: count('pass'), warn: count('warn'), fail: count('fail') };
  return { ...summary, worst: summary.fail > 0 ? 'fail' : summary.warn > 0 ? 'warn' : 'pass' };
}
