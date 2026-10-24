import { sampleLesson } from '@lcg/lesson-schema/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readLessonContent, replaceLessonContent } from './documents.js';
import { captureVersion } from './generation.js';
import { recordEditors } from './lessons.js';
import {
  applyReviewAction,
  approveLessons,
  lessonHistory,
  listReleases,
  publishUnit,
  releaseExport,
  restoreVersion,
} from './review.js';
import { lessons, units } from './schema.js';
import { freshDatabase, importSampleUnit, setLessonStatus, type TestDatabase } from './testing.js';

let database: TestDatabase;
let unitId: string;
let l3: string;
const editor = () => ({ kind: 'user' as const, id: database.editorId, role: 'editor' as const });
const approver = () => ({ kind: 'user' as const, id: database.approverId, role: 'approver' as const });

beforeAll(async () => {
  database = await freshDatabase();
  unitId = await importSampleUnit(database.db, database.editorId);
  l3 = await setLessonStatus(database.db, unitId, 'L3', 'draft');
  await replaceLessonContent(database.db, l3, sampleLesson());
  await captureVersion(database.db, { lessonId: l3, reason: 'generated', content: sampleLesson() });
});
afterAll(() => database.close());

const statusOf = async (id: string) =>
  (await database.db.select({ status: lessons.status }).from(lessons).where(eq(lessons.id, id)))[0]!.status;

describe('review actions', () => {
  it('submits a Draft, freezing a Version, and keeps approval to Approvers', async () => {
    expect(await applyReviewAction(database.db, { lessonId: l3, actor: editor(), action: { type: 'submit' } })).toMatchObject({
      ok: true,
      to: 'in-review',
    });
    const refused = await applyReviewAction(database.db, { lessonId: l3, actor: editor(), action: { type: 'approve' } });
    expect(refused).toMatchObject({ ok: false, refusal: 'not-permitted' });
    const history = await lessonHistory(database.db, l3);
    expect(history.versions.map((v) => v.reason)).toEqual(['submitted', 'generated']);
  });

  it('refuses an action based on a stale view of the Lesson', async () => {
    const result = await applyReviewAction(database.db, {
      lessonId: l3,
      actor: approver(),
      action: { type: 'approve' },
      expectedTransitionCount: 0,
    });
    expect(result).toMatchObject({ ok: false, refusal: 'stale' });
  });

  it('requires a reason to request changes, then records it', async () => {
    expect(
      await applyReviewAction(database.db, { lessonId: l3, actor: approver(), action: { type: 'request-changes', reason: ' ' } }),
    ).toMatchObject({ ok: false, refusal: 'reason-required' });
    expect(
      await applyReviewAction(database.db, {
        lessonId: l3,
        actor: approver(),
        action: { type: 'request-changes', reason: 'Pulse Check 1 has two defensible answers.' },
      }),
    ).toMatchObject({ ok: true, to: 'changes-requested' });
    const [event] = (await lessonHistory(database.db, l3)).events;
    expect(event).toMatchObject({ action: 'request-changes', reason: 'Pulse Check 1 has two defensible answers.' });
  });

  it('records Self-Approval when the Approver edited the Lesson', async () => {
    await recordEditors(database.db, l3, [database.approverId]);
    await applyReviewAction(database.db, { lessonId: l3, actor: editor(), action: { type: 'submit' } });
    expect(await applyReviewAction(database.db, { lessonId: l3, actor: approver(), action: { type: 'approve' } })).toMatchObject({
      ok: true,
      to: 'approved',
    });
    const [event] = (await lessonHistory(database.db, l3)).events;
    expect(event).toMatchObject({ action: 'approve', selfApproval: true });
  });
});

describe('restoring a Version', () => {
  it('refuses while the Lesson is Approved, and restores as a new Version once editable', async () => {
    const original = (await lessonHistory(database.db, l3)).versions.find((v) => v.reason === 'generated')!;
    expect(await restoreVersion(database.db, { lessonId: l3, versionId: original.id, actor: editor() })).toMatchObject({ ok: false });

    await applyReviewAction(database.db, { lessonId: l3, actor: approver(), action: { type: 'reopen', reason: 'Typo' } });
    await replaceLessonContent(database.db, l3, { ...sampleLesson(), title: 'Changed after reopening' });
    expect(await restoreVersion(database.db, { lessonId: l3, versionId: original.id, actor: editor() })).toEqual({ ok: true });
    expect((await readLessonContent(database.db, l3))?.title).toBe(sampleLesson().title);
    expect((await lessonHistory(database.db, l3)).versions[0]!.reason).toBe('restored');
  });
});

describe('publishing a Unit', () => {
  it('refuses until every Lesson is Approved, naming what is waiting', async () => {
    const result = await publishUnit(database.db, { unitId, actor: approver() });
    expect(result).toMatchObject({ ok: false, message: expect.stringMatching(/47 Lessons are not Approved yet/) });
    expect(await publishUnit(database.db, { unitId, actor: editor() })).toMatchObject({
      ok: false,
      message: 'Only an Approver can publish a Unit.',
    });
  });

  it('freezes a Release of the Approved Versions; later edits do not change it', async () => {
    const all = await database.db.select({ id: lessons.id }).from(lessons).where(eq(lessons.unitId, unitId));
    for (const { id } of all) {
      if (id === l3) continue;
      await database.db.update(lessons).set({ status: 'in-review' }).where(eq(lessons.id, id));
      await replaceLessonContent(database.db, id, sampleLesson());
    }
    await applyReviewAction(database.db, { lessonId: l3, actor: editor(), action: { type: 'submit' } });
    const counts = await database.db
      .select({ id: lessons.id, expectedTransitionCount: lessons.transitionCount })
      .from(lessons)
      .where(eq(lessons.unitId, unitId));
    const bulk = await approveLessons(database.db, { unitId, lessons: counts.map(({ id, expectedTransitionCount }) => ({ id, expectedTransitionCount })), actor: approver() });
    expect(bulk.approved).toHaveLength(47);

    expect(await publishUnit(database.db, { unitId, actor: approver() })).toEqual({ ok: true, releaseNumber: 1 });
    const [release] = await listReleases(database.db, unitId);
    const exported = await releaseExport(database.db, release!.id);
    expect(exported!.lessons).toHaveLength(47);
    expect(exported!.lessons[2]).toMatchObject({ key: 'L3', lesson: { title: sampleLesson().title } });

    await applyReviewAction(database.db, { lessonId: l3, actor: approver(), action: { type: 'reopen', reason: 'Fix a date' } });
    await replaceLessonContent(database.db, l3, { ...sampleLesson(), title: 'Edited after release' });
    const [unit] = await database.db.select().from(units).where(eq(units.id, unitId));
    expect(unit!.hasUnpublishedChanges).toBe(true);
    expect((await releaseExport(database.db, release!.id))!.lessons[2]!.lesson.title).toBe(sampleLesson().title);
    expect(await statusOf(l3)).toBe('in-review');
  }, 120_000);

  it('numbers later Releases', async () => {
    await applyReviewAction(database.db, { lessonId: l3, actor: approver(), action: { type: 'approve' } });
    expect(await publishUnit(database.db, { unitId, actor: approver() })).toEqual({ ok: true, releaseNumber: 2 });
    const releases = await listReleases(database.db, unitId);
    expect(releases.map((r) => r.number)).toEqual([2, 1]);
    const latest = await releaseExport(database.db, releases[0]!.id);
    expect(latest!.lessons[2]!.lesson.title).toBe('Edited after release');
    const [unit] = await database.db.select({ flag: units.hasUnpublishedChanges }).from(units).where(eq(units.id, unitId));
    expect(unit!.flag).toBe(false);
  });
});

describe('requests from the browser', () => {
  // LCG-15 regression. Found by: Phase 4 spec review (the review action type was trusted from the browser).
  it('LCG-15: refuses an action that is not a review action, leaving the Lesson unchanged', async () => {
    const id = await setLessonStatus(database.db, unitId, 'L5', 'draft');
    const crafted = { type: 'regenerate' } as unknown as Parameters<typeof applyReviewAction>[1]['action'];
    const result = await applyReviewAction(database.db, { lessonId: id, actor: editor(), action: crafted });
    expect(result).toMatchObject({ ok: false, refusal: 'not-permitted' });
    expect(await statusOf(id)).toBe('draft');

    const badReason = { type: 'request-changes', reason: 42 } as unknown as Parameters<typeof applyReviewAction>[1]['action'];
    expect(await applyReviewAction(database.db, { lessonId: id, actor: approver(), action: badReason })).toMatchObject({ ok: false });
  });
});

describe('Self-Approval after a Restore', () => {
  // LCG-16 regression. Found by: Phase 4 spec review (restoring a Version was not counted as editing the Lesson).
  it('LCG-16: flags an approval as Self-Approval when the Approver restored the content', async () => {
    const id = await setLessonStatus(database.db, unitId, 'L6', 'draft');
    await replaceLessonContent(database.db, id, sampleLesson());
    await captureVersion(database.db, { lessonId: id, reason: 'generated', content: sampleLesson() });
    const [version] = (await lessonHistory(database.db, id)).versions;

    expect(await restoreVersion(database.db, { lessonId: id, versionId: version!.id, actor: approver() })).toEqual({ ok: true });
    await applyReviewAction(database.db, { lessonId: id, actor: editor(), action: { type: 'submit' } });
    await applyReviewAction(database.db, { lessonId: id, actor: approver(), action: { type: 'approve' } });
    const [event] = (await lessonHistory(database.db, id)).events;
    expect(event).toMatchObject({ action: 'approve', selfApproval: true });
  });
});

describe('bulk approval', () => {
  // LCG-18 regression. Found by: Phase 4 spec review (bulk approve skipped the stale-state and Unit checks).
  it('LCG-18: refuses Lessons changed since the board loaded, and Lessons of another Unit', async () => {
    const otherUnit = await importSampleUnit(database.db, database.editorId);
    const fresh = await setLessonStatus(database.db, unitId, 'L7', 'in-review');
    const stale = await setLessonStatus(database.db, unitId, 'L8', 'in-review');
    const foreign = await setLessonStatus(database.db, otherUnit, 'L7', 'in-review');
    const countOf = async (id: string) =>
      (await database.db.select({ n: lessons.transitionCount }).from(lessons).where(eq(lessons.id, id)))[0]!.n;

    const result = await approveLessons(database.db, {
      unitId,
      actor: approver(),
      lessons: [
        { id: fresh, expectedTransitionCount: await countOf(fresh) },
        { id: stale, expectedTransitionCount: (await countOf(stale)) - 1 },
        { id: foreign, expectedTransitionCount: await countOf(foreign) },
      ],
    });
    expect(result.approved).toEqual([fresh]);
    expect(result.refused.map((r) => r.lessonId).sort()).toEqual([stale, foreign].sort());
    expect(await statusOf(foreign)).toBe('in-review');
  });
});
