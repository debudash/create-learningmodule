import { sampleLesson } from '@lcg/lesson-schema/testing';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readLessonContent, replaceLessonContent } from './documents.js';
import { lessons } from './schema.js';
import { freshDatabase, importSampleUnit } from './testing.js';

let database: Awaited<ReturnType<typeof freshDatabase>>;
let lessonId: string;

beforeAll(async () => {
  database = await freshDatabase();
  const unitId = await importSampleUnit(database.db, database.editorId);
  const [row] = await database.db
    .select({ id: lessons.id })
    .from(lessons)
    .where(and(eq(lessons.unitId, unitId), eq(lessons.key, 'L3')));
  lessonId = row!.id;
});
afterAll(() => database.close());

describe('Lesson content persistence', () => {
  it('has no content before anything is written', async () => {
    expect(await readLessonContent(database.db, lessonId)).toBeUndefined();
  });

  it('stores a whole Lesson and reads it back unchanged', async () => {
    const lesson = sampleLesson();
    await replaceLessonContent(database.db, lessonId, lesson);
    expect(await readLessonContent(database.db, lessonId)).toEqual(lesson);
  });

  it('replaces content on a second write', async () => {
    const lesson = { ...sampleLesson(), title: 'Second draft' };
    await replaceLessonContent(database.db, lessonId, lesson);
    expect((await readLessonContent(database.db, lessonId))?.title).toBe('Second draft');
  });
});
