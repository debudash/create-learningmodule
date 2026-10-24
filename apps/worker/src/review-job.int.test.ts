import { currentFailingChecks, lessonChecks, replaceLessonContent } from '@lcg/db';
import { freshDatabase, importSampleUnit, setLessonStatus, type TestDatabase } from '@lcg/db/testing';
import { createFakeClient, type LlmClient } from '@lcg/generation';
import { sampleLesson } from '@lcg/lesson-schema/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handleReviewJob } from './review-job.js';

let database: TestDatabase;
let unitId: string;

beforeAll(async () => {
  database = await freshDatabase();
  unitId = await importSampleUnit(database.db, database.editorId);
});
afterAll(() => database.close());

const failingVerdict = JSON.stringify({
  standards: [{ code: 'RL.6.1', verdict: 'not-taught', reason: 'No Activity cites the text.' }],
  anchorText: { verdict: 'uses', reason: 'Chapter 4.' },
});

async function lessonWithContent(key: string): Promise<string> {
  const lessonId = await setLessonStatus(database.db, unitId, key, 'draft');
  await replaceLessonContent(database.db, lessonId, sampleLesson());
  return lessonId;
}

describe('the AI Review job', () => {
  // LCG-20, found by the Phase 5 spec review: a review of old content landed as current.
  it('LCG-20: keeps a review that judged since-edited content from counting', async () => {
    const lessonId = await lessonWithContent('L3');
    const failingBefore = await currentFailingChecks(database.db, lessonId);
    const editsMidReview: LlmClient = {
      ...createFakeClient(() => failingVerdict),
      async complete(request) {
        await replaceLessonContent(database.db, lessonId, { ...sampleLesson(), title: 'Edited during the review' });
        return createFakeClient(() => failingVerdict).complete(request);
      },
    };

    await handleReviewJob({ db: database.db, clientFor: () => editsMidReview }, { lessonId });

    expect(await currentFailingChecks(database.db, lessonId)).toBe(failingBefore);
    const ai = (await lessonChecks(database.db, lessonId)).filter((r) => r.source === 'ai-review');
    expect(ai.length).toBeGreaterThan(0);
    expect(ai.every((r) => !r.current)).toBe(true);
  });

  // LCG-21, found by the Phase 5 spec review: two reviews at once both deleted, then both inserted.
  it('LCG-21: keeps one set of results when two reviews of a Lesson finish together', async () => {
    const lessonId = await lessonWithContent('L4');
    const review = () => handleReviewJob({ db: database.db, clientFor: () => createFakeClient(() => failingVerdict) }, { lessonId });
    await Promise.all([review(), review(), review()]);

    const ai = (await lessonChecks(database.db, lessonId)).filter((r) => r.source === 'ai-review');
    const once = new Set(ai.map((r) => `${r.checkId}:${r.message}`)).size;
    expect(ai).toHaveLength(once);
  });
});
