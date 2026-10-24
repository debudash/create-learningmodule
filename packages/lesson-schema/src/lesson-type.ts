/**
 * The instructional pattern a Lesson follows. Determines its Sections and their
 * target minutes (see GLOSSARY: Lesson Type).
 */
export const LESSON_TYPES = [
  'spark',
  'core-reading',
  'core-writing',
  'academic-discussion',
  'writing',
  'flex-day',
] as const;

export type LessonType = (typeof LESSON_TYPES)[number];

export const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  spark: 'Spark',
  'core-reading': 'Core Reading',
  'core-writing': 'Core Writing',
  'academic-discussion': 'Academic Discussion',
  writing: 'Writing',
  'flex-day': 'Flex Day',
};
