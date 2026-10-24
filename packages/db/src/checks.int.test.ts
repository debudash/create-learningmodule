import type { QualityCheckResult } from '@lcg/domain';
import { sampleLesson } from '@lcg/lesson-schema/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkCounts, lessonChecks, replaceCheckResults } from './checks.js';
import { replaceLessonContent } from './documents.js';
import { applyReviewAction, lessonHistory } from './review.js';
import { freshDatabase, importSampleUnit, setLessonStatus, type TestDatabase } from './testing.js';

let database: TestDatabase;
let unitId: string;
const editor = () => ({ kind: 'user' as const, id: database.editorId, role: 'editor' as const });
const approver = () => ({ kind: 'user' as const, id: database.approverId, role: 'approver' as const });

const aiFail: QualityCheckResult = {
  checkId: 'ai-standard',
  source: 'ai-review',
  outcome: 'fail',
  message: 'RL.6.1: no Activity cites the text.',
};

beforeAll(async () => {
  database = await freshDatabase();
  unitId = await importSampleUnit(database.db, database.editorId);
});
afterAll(() => database.close());

describe('AI Review results after an edit', () => {
  // LCG-19, found by the Phase 5 spec review: AI verdicts on old content still counted as failing.
  it('LCG-19: stops counting an AI Review result once the content it judged has changed', async () => {
    const lessonId = await setLessonStatus(database.db, unitId, 'L3', 'draft');
    await replaceLessonContent(database.db, lessonId, sampleLesson());
    await replaceCheckResults(database.db, lessonId, 'ai-review', [aiFail]);
    expect((await checkCounts(database.db, [lessonId])).get(lessonId)?.fail).toBeGreaterThan(0);
    const failingBefore = (await checkCounts(database.db, [lessonId])).get(lessonId)!.fail;

    await replaceLessonContent(database.db, lessonId, { ...sampleLesson(), title: 'An edited title' });

    expect((await checkCounts(database.db, [lessonId])).get(lessonId)!.fail).toBe(failingBefore - 1);
    expect((await lessonChecks(database.db, lessonId)).find((r) => r.source === 'ai-review')).toMatchObject({ current: false });

    await applyReviewAction(database.db, { lessonId, actor: editor(), action: { type: 'submit' } });
    await applyReviewAction(database.db, { lessonId, actor: approver(), action: { type: 'approve' } });
    const [event] = (await lessonHistory(database.db, lessonId)).events;
    expect(event).toMatchObject({ action: 'approve', overFailingChecks: failingBefore - 1 > 0 });
  });
});
