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
