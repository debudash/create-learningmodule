import { sampleLesson } from '@lcg/lesson-schema/testing';
import { and, asc, eq } from 'drizzle-orm';
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
    const bulk = await approveLessons(database.db, { lessonIds: all.map((l) => l.id), actor: approver() });
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
  });

  it('numbers later Releases', async () => {
    await applyReviewAction(database.db, { lessonId: l3, actor: approver(), action: { type: 'approve' } });
    expect(await publishUnit(database.db, { unitId, actor: approver() })).toEqual({ ok: true, releaseNumber: 2 });
    const releases = await listReleases(database.db, unitId);
    expect(releases.map((r) => r.number)).toEqual([2, 1]);
    const latest = await releaseExport(database.db, releases[0]!.id);
    expect(latest!.lessons[2]!.lesson.title).toBe('Edited after release');
    const [unit] = await database.db
      .select({ flag: units.hasUnpublishedChanges })
      .from(units)
      .where(and(eq(units.id, unitId)))
      .orderBy(asc(units.id));
    expect(unit!.flag).toBe(false);
  });
});
