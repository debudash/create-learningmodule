import { sampleLessonJson } from '@lcg/fixtures';
import { lessonSchema, type Lesson } from './lesson.js';

/** A hand-written Spark Lesson (Unit 4, Lesson 3), validated against the Lesson schema. */
export function sampleLesson(): Lesson {
  return lessonSchema.parse(sampleLessonJson());
}
