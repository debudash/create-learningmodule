import { NO_USAGE, type EditResult } from '@lcg/generation';
import { sampleLesson } from '@lcg/lesson-schema/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { replaceLessonContent } from './documents.js';
import { unitBoard } from './queries.js';
import { lessonHistory } from './review.js';
import { recordSuggestion, resolveSuggestion } from './suggestions.js';
import { freshDatabase, importSampleUnit, setLessonStatus, setLessonStatusById, type TestDatabase } from './testing.js';

let database: TestDatabase;
let unitId: string;
let lessonId: string;
const editor = () => ({ kind: 'user' as const, id: database.editorId, role: 'editor' as const });
const approver = () => ({ kind: 'user' as const, id: database.approverId, role: 'approver' as const });

const partB = sampleLesson()
  .sections.flatMap((s) => s.activities)
  .find((a) => a.id === 'lia-part-b')!;
const live = { model: 'claude-sonnet-5-5', mode: 'live' as const, usage: { ...NO_USAGE, outputTokens: 100_000 }, costUsd: 1, durationMs: 900 };
const suggested: EditResult = {
  ok: true,
  activity: { ...partB, blocks: [...partB.blocks, { type: 'sample-response', text: 'A modern city.' }] },
  call: live,
};

beforeAll(async () => {
  database = await freshDatabase();
  unitId = await importSampleUnit(database.db, database.editorId);
  lessonId = await setLessonStatus(database.db, unitId, 'L3', 'draft');
  await replaceLessonContent(database.db, lessonId, sampleLesson());
});
afterAll(() => database.close());

const record = (result: EditResult = suggested) =>
  recordSuggestion(database.db, { lessonId, actor: editor(), action: 'add-sample-response', before: partB, result });

describe('AI Suggestions', () => {
  it('records each suggestion with its cost, counted in the Unit cost', async () => {
    const before = (await unitBoard(database.db, unitId))!.aiCostUsd;
    const { id } = await record();
    expect(id).toBeTruthy();
    expect((await unitBoard(database.db, unitId))!.aiCostUsd).toBeCloseTo(before + 1, 4);
  });

  it('lets only the person who asked accept or reject it, once', async () => {
    const { id } = await record();
    expect(await resolveSuggestion(database.db, { suggestionId: id, actor: approver(), outcome: 'accepted' })).toMatchObject({
      ok: false,
    });
    expect(await resolveSuggestion(database.db, { suggestionId: id, actor: editor(), outcome: 'accepted' })).toEqual({ ok: true });
    expect(await resolveSuggestion(database.db, { suggestionId: id, actor: editor(), outcome: 'rejected' })).toMatchObject({
      ok: false,
    });
  });

  it('lists accepted suggestions in the Lesson history with who accepted them', async () => {
    const history = await lessonHistory(database.db, lessonId);
    expect(history.suggestions).toEqual([
      expect.objectContaining({ action: 'add-sample-response', activityId: 'lia-part-b', actorName: expect.any(String) }),
    ]);
  });

  it('keeps a failed suggestion for its cost, but it cannot be accepted', async () => {
    const { id } = await record({ ok: false, failure: 'invalid', reason: 'Not an Activity.', call: live });
    expect(await resolveSuggestion(database.db, { suggestionId: id, actor: editor(), outcome: 'accepted' })).toMatchObject({
      ok: false,
    });
  });

  it('refuses to accept a suggestion once the Lesson is Approved', async () => {
    const { id } = await record();
    await setLessonStatusById(database.db, lessonId, 'approved');
    expect(await resolveSuggestion(database.db, { suggestionId: id, actor: editor(), outcome: 'accepted' })).toMatchObject({
      ok: false,
      message: expect.stringMatching(/Approved/),
    });
    expect(await resolveSuggestion(database.db, { suggestionId: id, actor: editor(), outcome: 'rejected' })).toEqual({ ok: true });
  });
});
