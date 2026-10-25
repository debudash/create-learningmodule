import {
  LESSON_MINUTES,
  LESSON_TYPE_LABELS,
  lessonMinutes,
  sectionMinutes,
  sectionPlanProblems,
  studentView,
  targetMinutes,
  TEACHER_ONLY_BLOCKS,
  type Block,
  type Lesson,
  type LessonType,
} from '@lcg/lesson-schema';
import { hasStandard } from '@lcg/standards';

export type CheckOutcome = 'pass' | 'warn' | 'fail';

/** People-facing names of the checks; the keys are every check there is. */
export const CHECK_LABELS = {
  sections: 'Sections',
  pacing: 'Lesson pacing',
  'section-pacing': 'Section pacing',
  'focus-standards-taught': 'Focus Standards taught',
  'known-standards': 'Standard tags',
  vocabulary: 'Outline vocabulary',
  'pulse-check': 'Pulse Check',
  'eld-support': 'ELD support',
  'student-view': 'Student View',
  'ai-standard': 'AI Review: standard',
  'ai-anchor-text': "AI Review: the Lesson's texts",
} as const;

export type CheckId = keyof typeof CHECK_LABELS;

/** One Quality Check result (GLOSSARY: Quality Check). */
export interface QualityCheckResult {
  checkId: CheckId;
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

/** Minutes a whole Lesson may run off 50 and still pass. */
const PACING_TOLERANCE = 5;

/**
 * Lesson Types whose Lessons include a Pulse Check: the Lesson Types whose example
 * Lessons (Units 1-3) have one. Writing and Flex Day examples have none.
 */
const NEEDS_PULSE_CHECK: ReadonlySet<LessonType> = new Set(['spark', 'core-reading', 'core-writing', 'academic-discussion']);

const rule = (checkId: CheckId, outcome: CheckOutcome, message: string, location?: string): QualityCheckResult => ({
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
    ...sections(lesson),
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

function sections(lesson: Lesson): QualityCheckResult[] {
  const problems = sectionPlanProblems(
    lesson.lessonType,
    lesson.sections.map((s) => s.kind),
  );
  return problems.length === 0
    ? [rule('sections', 'pass', `The Lesson has the Sections a ${LESSON_TYPE_LABELS[lesson.lessonType]} Lesson needs.`)]
    : problems.map((problem) => rule('sections', 'fail', problem));
}

function pacing(lesson: Lesson): QualityCheckResult[] {
  const minutes = lessonMinutes(lesson);
  const off = Math.abs(minutes - LESSON_MINUTES);
  if (off === 0) return [rule('pacing', 'pass', `The Lesson runs ${LESSON_MINUTES} minutes.`)];
  const message = `The Lesson runs ${minutes} minutes; it should be ${LESSON_MINUTES}.`;
  return [rule('pacing', off > PACING_TOLERANCE ? 'fail' : 'pass', message)];
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
        section.activities[0]?.id,
      ),
    ];
  });
  return results.length > 0 ? results : [rule('section-pacing', 'pass', 'Every Section is on its target.')];
}

function focusStandardsTaught(lesson: Lesson, outline: CheckOutlineFacts): QualityCheckResult[] {
  const tagged = new Set(lesson.sections.flatMap((s) => s.activities.flatMap((a) => a.standards)));
  const missing = outline.focusStandards.filter((code) => !tagged.has(code));
  if (missing.length === 0) return [rule('focus-standards-taught', 'pass', 'Every Focus Standard is taught by an Activity.')];
  return missing.map((code) =>
    rule('focus-standards-taught', 'fail', `No Activity is tagged with the Focus Standard ${code}.`, mainActivityId(lesson)),
  );
}

/** Every standard code is a real one, and every Activity tag is one of the Lesson's standards. */
function knownStandards(lesson: Lesson): QualityCheckResult[] {
  const { header } = lesson;
  const own = new Set([
    ...header.focusStandards,
    ...header.supportingStandards,
    ...header.eldStandards,
    ...header.mediaLiteracyStandards,
  ]);
  const unknownCodes = [...own].filter((code) => !hasStandard(code));
  const results = [
    ...unknownCodes.map((code) => rule('known-standards', 'fail', `${code} is not a Grade 6 standard code.`)),
    ...lesson.sections.flatMap((section) =>
      section.activities.flatMap((activity) => {
        const stray = activity.standards.filter((code) => !own.has(code));
        return stray.length > 0
          ? [
              rule(
                'known-standards',
                'warn',
                `${activity.title} is tagged with ${stray.join(', ')}, which ${stray.length === 1 ? 'is' : 'are'} not among this Lesson's standards.`,
                activity.id,
              ),
            ]
          : [];
      }),
    ),
  ];
  return results.length > 0 ? results : [rule('known-standards', 'pass', "Every tag is one of the Lesson's standards.")];
}

function vocabulary(lesson: Lesson, outline: CheckOutlineFacts): QualityCheckResult[] {
  const defined = new Set(lesson.header.vocabulary.map((v) => v.word.toLowerCase().replace(/[()]/g, '')));
  const missing = outline.vocabulary.filter((word) => !defined.has(word.toLowerCase().replace(/[()]/g, '')));
  if (missing.length === 0) return [rule('vocabulary', 'pass', 'Every Outline vocabulary word is defined.')];
  return [rule('vocabulary', 'warn', `The Outline's vocabulary is not all defined: ${missing.join(', ')}.`)];
}

/** Lessons of the Lesson Types that call for one have a Pulse Check (the schema makes each one well-formed). */
function pulseCheck(lesson: Lesson): QualityCheckResult[] {
  if (!NEEDS_PULSE_CHECK.has(lesson.lessonType)) return [rule('pulse-check', 'pass', 'This Lesson Type needs no Pulse Check.')];
  const has = lesson.sections.some((s) => s.activities.some((a) => a.blocks.some((b) => b.type === 'pulse-check')));
  return has
    ? [rule('pulse-check', 'pass', 'The Lesson checks understanding with a Pulse Check.')]
    : [rule('pulse-check', 'fail', `${LESSON_TYPE_LABELS[lesson.lessonType]} Lessons need at least one Pulse Check.`, mainActivityId(lesson))];
}

/**
 * Where a Lesson-wide gap is best fixed: the first Learning in Action Activity,
 * so "Fix with AI" has an Activity to work on (story 120).
 */
function mainActivityId(lesson: Lesson): string | undefined {
  return lesson.sections.find((s) => s.kind === 'learning-in-action')?.activities[0]?.id;
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

/** Text shorter than this is too common ("Turn and talk.") to count as leaked when it appears twice. */
const LEAK_MIN_LENGTH = 20;

/**
 * Nothing written for teachers reaches the Student View: no teacher-only block's
 * text (scripts, sample responses, notes, ELD panels, support tables) and no
 * Pulse Check answer or rationale.
 */
function studentViewClean(lesson: Lesson): QualityCheckResult[] {
  const visible = JSON.stringify(studentView(lesson));
  for (const activity of lesson.sections.flatMap((s) => s.activities)) {
    const teacherTexts = activity.blocks.flatMap(teacherOnlyTexts).filter((text) => text.length > LEAK_MIN_LENGTH);
    if (teacherTexts.some((text) => visible.includes(JSON.stringify(text).slice(1, -1)))) {
      return [rule('student-view', 'fail', `Teacher-only material from ${activity.title} appears in the Student View.`, activity.id)];
    }
  }
  return [rule('student-view', 'pass', 'The Student View holds no teacher-only material.')];
}

function teacherOnlyTexts(block: Block): string[] {
  if (block.type === 'pulse-check') return block.choices.map((c) => c.rationale);
  return TEACHER_ONLY_BLOCKS.has(block.type) ? stringsIn(block) : [];
}

function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === 'object') return Object.values(value).flatMap(stringsIn);
  return [];
}

/** How many results passed, warned and failed. */
export interface CheckCounts {
  pass: number;
  warn: number;
  fail: number;
}

export const NO_CHECKS: CheckCounts = { pass: 0, warn: 0, fail: 0 };

export function countChecks(results: readonly { outcome: CheckOutcome }[]): CheckCounts {
  const count = (outcome: CheckOutcome) => results.filter((r) => r.outcome === outcome).length;
  return { pass: count('pass'), warn: count('warn'), fail: count('fail') };
}
