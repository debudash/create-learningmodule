import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lessonSchema, type Lesson } from './lesson.js';

const FIXTURE = fileURLToPath(
  new URL('../../../fixtures/lessons/g6-u4-l03-spark.json', import.meta.url),
);

/** A hand-written Spark Lesson (Unit 4, Lesson 3), validated against the Lesson schema. */
export function sampleLesson(): Lesson {
  return lessonSchema.parse(JSON.parse(readFileSync(FIXTURE, 'utf8')));
}
