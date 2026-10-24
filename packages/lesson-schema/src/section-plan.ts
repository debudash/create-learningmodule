import type { SectionKind } from './lesson.js';
import type { LessonType } from './lesson-type.js';

export interface PlannedSection {
  kind: SectionKind;
  /** Target minutes, as in Newsela's published Lessons of this type. */
  minutes: number;
  required: boolean;
}

/** Every Lesson is one ~50-minute class period. */
export const LESSON_MINUTES = 50;

const CORE: PlannedSection[] = [
  { kind: 'launch', minutes: 5, required: true },
  { kind: 'literacy-lab', minutes: 10, required: true },
  { kind: 'learning-in-action', minutes: 30, required: true },
  { kind: 'look-back', minutes: 5, required: true },
  { kind: 'homework', minutes: 0, required: false },
];

/**
 * The Sections each Lesson Type uses, in their fixed order. Spark Lessons have a
 * longer Launch and no Literacy Lab; Flex Days spend 40 minutes on Huddles.
 */
export const SECTION_PLANS: Record<LessonType, PlannedSection[]> = {
  spark: [
    { kind: 'launch', minutes: 15, required: true },
    { kind: 'learning-in-action', minutes: 30, required: true },
    { kind: 'look-back', minutes: 5, required: true },
    { kind: 'homework', minutes: 0, required: false },
  ],
  'core-reading': CORE,
  'core-writing': CORE,
  'academic-discussion': CORE,
  writing: CORE,
  'flex-day': [
    { kind: 'launch', minutes: 5, required: true },
    { kind: 'learning-in-action', minutes: 40, required: true },
    { kind: 'look-back', minutes: 5, required: true },
  ],
};

/**
 * Why a sequence of Sections does not fit a Lesson Type's plan: a required Section
 * missing, a Section the type does not use, or Sections out of order.
 */
export function sectionPlanProblems(lessonType: LessonType, kinds: SectionKind[]): string[] {
  const plan = SECTION_PLANS[lessonType].map((p) => p.kind);
  const problems = SECTION_PLANS[lessonType]
    .filter((p) => p.required && !kinds.includes(p.kind))
    .map((p) => `A ${lessonType} Lesson needs a ${p.kind} Section.`);
  for (const kind of kinds) {
    if (!plan.includes(kind)) problems.push(`A ${lessonType} Lesson has no ${kind} Section.`);
  }
  const order = kinds.map((k) => plan.indexOf(k)).filter((i) => i >= 0);
  if (order.some((index, i) => i > 0 && index <= order[i - 1]!)) {
    problems.push(`Sections must appear in the order ${plan.join(', ')}.`);
  }
  return problems;
}

/** Minutes of a Section: the sum of its Activities. */
export function sectionMinutes(section: { activities: { minutes: number }[] }): number {
  return section.activities.reduce((sum, activity) => sum + activity.minutes, 0);
}

/** Minutes of a whole Lesson. */
export function lessonMinutes(lesson: { sections: { activities: { minutes: number }[] }[] }): number {
  return lesson.sections.reduce((sum, section) => sum + sectionMinutes(section), 0);
}

/** The target minutes of a Section in a Lesson of this type, if the type uses it. */
export function targetMinutes(lessonType: LessonType, kind: SectionKind): number | undefined {
  return SECTION_PLANS[lessonType].find((p) => p.kind === kind)?.minutes;
}
