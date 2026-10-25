import {
  beginGenerating,
  cancelGeneration,
  lessonChecks,
  failStalledGenerations,
  unitBoard,
  readLessonContent,
  regenerateLesson,
  replaceLessonContent,
  schema,
  startGeneration,
  type EnqueueGeneration,
  type GenerationJob,
} from '@lcg/db';
import { freshDatabase, importSampleUnit, setLessonStatusById, type TestDatabase } from '@lcg/db/testing';
import { createFakeClient, NO_USAGE, placeholderOutput, PROMPT_VERSION, type LlmRequest } from '@lcg/generation';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handleGenerateJob, type GenerateJobDeps } from './generate-job.js';
import { handleReviewJob } from './review-job.js';

let database: TestDatabase;
let unitId: string;
const jobs: GenerationJob[] = [];
const prompts = new Map<string, LlmRequest>();
const enqueue: EnqueueGeneration = async (_tx, job) => {
  jobs.push(job);
};

beforeAll(async () => {
  database = await freshDatabase();
  unitId = await importSampleUnit(database.db, database.editorId);
});
afterAll(() => database.close());

function deps(respond?: (request: LlmRequest) => string): GenerateJobDeps {
  return {
    db: database.db,
    enqueue,
    clientFor: (context) =>
      createFakeClient((request) => {
        prompts.set(context.outline.key, request);
        return respond ? respond(request) : JSON.stringify(placeholderOutput(context.outline));
      }),
    exampleFor: (type) => `Example for ${type}`,
  };
}

async function lessonsByKey(keys: string[]) {
  return database.db
    .select()
    .from(schema.lessons)
    .where(and(eq(schema.lessons.unitId, unitId), inArray(schema.lessons.key, keys)))
    .orderBy(asc(schema.lessons.position));
}

/** Runs queued jobs as the worker would, including jobs they enqueue. */
async function drain(dependencies: GenerateJobDeps) {
  while (jobs.length > 0) await handleGenerateJob(dependencies, jobs.shift()!, { finalAttempt: true });
}

const showcase = ['L36', 'L37', 'L38', 'L39', 'L40', 'L41', 'F5', 'F6'];
const editor = () => ({ kind: 'user' as const, id: database.editorId, role: 'editor' as const });

describe('generating a Unit', () => {
  it('queues the Arc, holding back its Flex Days until the Arc has content', async () => {
    const ids = (await lessonsByKey(showcase)).map((l) => l.id);
    const result = await startGeneration(database.db, { unitId, lessonIds: ids, actor: editor(), enqueue });
    expect(result).toEqual({ queued: 8, waiting: 2 });
    expect(jobs).toHaveLength(6);
    expect(new Set((await lessonsByKey(showcase)).map((l) => l.status))).toEqual(new Set(['queued']));
  });

  it('generates every Lesson to Draft, then the Flex Days with the Arc\'s Digests', async () => {
    await drain(deps());
    const rows = await lessonsByKey(showcase);
    expect(rows.map((l) => [l.key, l.status])).toEqual(showcase.map((key) => [key, 'draft']));
    expect(rows.every((l) => l.digest && l.jobEnqueuedAt === null)).toBe(true);

    const l36 = rows[0]!;
    expect((await readLessonContent(database.db, l36.id))?.lessonType).toBe('writing');
    const versions = await database.db.select().from(schema.lessonVersions).where(eq(schema.lessonVersions.lessonId, l36.id));
    expect(versions.map((v) => [v.number, v.reason])).toEqual([[1, 'generated']]);
    const attempts = await database.db.select().from(schema.generationAttempts).where(eq(schema.generationAttempts.lessonId, l36.id));
    expect(attempts).toMatchObject([{ outcome: 'succeeded', mode: 'fake', promptVersion: PROMPT_VERSION }]);

    expect(prompts.get('F5')!.messages[0]!.content).toContain('<arc_lessons_taught>');
    expect(prompts.get('F5')!.messages[0]!.content).toContain('Placeholder for L41.');
  });

  it('records the workflow events along the way', async () => {
    const [l36] = await lessonsByKey(['L36']);
    const events = await database.db
      .select({ action: schema.workflowEvents.action, to: schema.workflowEvents.toStatus })
      .from(schema.workflowEvents)
      .where(eq(schema.workflowEvents.lessonId, l36!.id))
      .orderBy(asc(schema.workflowEvents.createdAt));
    expect(events).toEqual([
      { action: 'queue', to: 'queued' },
      { action: 'start-generating', to: 'generating' },
      { action: 'finish-generating', to: 'draft' },
    ]);
  });

  it('marks a Lesson Generation Failed when the last attempt fails, keeping the reason', async () => {
    const [l1] = await lessonsByKey(['L1']);
    await startGeneration(database.db, { unitId, lessonIds: [l1!.id], actor: editor(), enqueue });
    await drain(deps(() => 'not json'));
    const [after] = await lessonsByKey(['L1']);
    expect(after!.status).toBe('generation-failed');
    const attempts = await database.db.select().from(schema.generationAttempts).where(eq(schema.generationAttempts.lessonId, l1!.id));
    expect(attempts[0]).toMatchObject({ outcome: 'failed', schemaViolations: ['The output is not valid JSON.'] });
  });

  it('retries a failed attempt when it is not the last, leaving the Lesson Generating', async () => {
    const [l2] = await lessonsByKey(['L2']);
    await startGeneration(database.db, { unitId, lessonIds: [l2!.id], actor: editor(), enqueue });
    const job = jobs.shift()!;
    await expect(handleGenerateJob(deps(() => 'not json'), job, { finalAttempt: false })).rejects.toThrow();
    expect((await lessonsByKey(['L2']))[0]!.status).toBe('generating');
    await handleGenerateJob(deps(), job, { finalAttempt: true });
    expect((await lessonsByKey(['L2']))[0]!.status).toBe('draft');
  });

  it('does nothing for a job whose Lesson was taken out of the queue', async () => {
    const [l3] = await lessonsByKey(['L3']);
    await startGeneration(database.db, { unitId, lessonIds: [l3!.id], actor: editor(), enqueue });
    expect(await cancelGeneration(database.db, { unitId, actor: editor() })).toBe(1);
    await drain(deps());
    expect((await lessonsByKey(['L3']))[0]!.status).toBe('outlined');
  });
});

describe('regenerating a Lesson', () => {
  // LCG-9 regression. Found by: Phase 3 spec review (Regenerate discarded the edited content from history).
  it('LCG-9: keeps the content it replaces as a Lesson Version', async () => {
    const [l2] = await lessonsByKey(['L2']);
    const edited = { ...(await readLessonContent(database.db, l2!.id))!, title: 'Edited by an Editor' };
    await replaceLessonContent(database.db, l2!.id, edited);

    const result = await regenerateLesson(database.db, {
      lessonId: l2!.id,
      actor: editor(),
      instructions: 'Shorter Launch',
      enqueue,
    });
    expect(result.ok).toBe(true);
    await drain(deps());

    const versions = await database.db
      .select({ number: schema.lessonVersions.number, reason: schema.lessonVersions.reason, content: schema.lessonVersions.content })
      .from(schema.lessonVersions)
      .where(eq(schema.lessonVersions.lessonId, l2!.id))
      .orderBy(asc(schema.lessonVersions.number));
    expect(versions.map((v) => v.reason)).toEqual(['generated', 'replaced', 'regenerated']);
    expect((versions[1]!.content as { title: string }).title).toBe('Edited by an Editor');
  });
});

describe('stale generation jobs', () => {
  // LCG-10 regression. Found by: Phase 3 spec review (cancel then restart could generate a Lesson twice).
  it('LCG-10: a job sent before a cancel does not generate the Lesson again', async () => {
    const [l5] = await lessonsByKey(['L5']);
    await startGeneration(database.db, { unitId, lessonIds: [l5!.id], actor: editor(), enqueue });
    const stale = jobs.shift()!;
    await cancelGeneration(database.db, { unitId, actor: editor() });
    await startGeneration(database.db, { unitId, lessonIds: [l5!.id], actor: editor(), enqueue });
    const current = jobs.shift()!;

    // Hold the stale job inside its model call while the current job runs to the end.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const held: GenerateJobDeps = {
      ...deps(),
      clientFor: (context) => ({
        mode: 'fake',
        model: 'fake',
        complete: async () => {
          await gate;
          return { text: JSON.stringify(placeholderOutput(context.outline)), model: 'fake', stopReason: 'end_turn', usage: NO_USAGE, durationMs: 0 };
        },
      }),
    };
    const staleRun = handleGenerateJob(held, stale, { finalAttempt: true });
    await new Promise((r) => setTimeout(r, 300));
    await handleGenerateJob(deps(), current, { finalAttempt: true });
    release();
    await staleRun;

    const attempts = await database.db.select().from(schema.generationAttempts).where(eq(schema.generationAttempts.lessonId, l5!.id));
    const versions = await database.db.select().from(schema.lessonVersions).where(eq(schema.lessonVersions.lessonId, l5!.id));
    expect(attempts).toHaveLength(1);
    expect(versions).toHaveLength(1);
    expect((await lessonsByKey(['L5']))[0]!.status).toBe('draft');
  });
});

describe('stalled generations', () => {
  // LCG-11 regression. Found by: Phase 3 spec review (a crash on the last attempt left a Lesson Generating forever).
  it('LCG-11: fails a Lesson left Generating long after its job stopped, and leaves recent ones alone', async () => {
    const [l6, l7] = await lessonsByKey(['L6', 'L7']);
    await database.db
      .update(schema.lessons)
      .set({ status: 'generating', updatedAt: new Date(Date.now() - 60 * 60 * 1000) })
      .where(eq(schema.lessons.id, l6!.id));
    await database.db.update(schema.lessons).set({ status: 'generating' }).where(eq(schema.lessons.id, l7!.id));

    expect(await failStalledGenerations(database.db, { olderThanMinutes: 30 })).toBe(1);
    const [after6, after7] = await lessonsByKey(['L6', 'L7']);
    expect(after6!.status).toBe('generation-failed');
    expect(after7!.status).toBe('generating');
    const board = await unitBoard(database.db, unitId);
    expect(board!.lessons.find((l) => l.key === 'L6')!.failureReason).toMatch(/stopped/);
  });

  // LCG-29, found by the first live trial: a retry that started late was failed by the sweep while it ran.
  it('LCG-29: counts a retry starting as a sign of life, so the sweep leaves it alone', async () => {
    const [l9] = await lessonsByKey(['L9']);
    jobs.length = 0;
    await startGeneration(database.db, { unitId, lessonIds: [l9!.id], actor: editor(), enqueue });
    const job = jobs.shift()!;
    expect(await beginGenerating(database.db, job)).toBe(true);
    // The first attempt failed long ago (here: the laptop slept); the retry starts now.
    await database.db
      .update(schema.lessons)
      .set({ updatedAt: new Date(Date.now() - 60 * 60 * 1000) })
      .where(eq(schema.lessons.id, l9!.id));

    expect(await beginGenerating(database.db, job)).toBe(true);
    expect(await failStalledGenerations(database.db, { olderThanMinutes: 30 })).toBe(0);
    expect((await lessonsByKey(['L9']))[0]!.status).toBe('generating');
  });

  // LCG-30, found by the first live trial: a late result was saved into a Lesson already marked failed.
  it('LCG-30: keeps the cost of a result that arrives after the Lesson stopped Generating, but not its content', async () => {
    const [l12] = await lessonsByKey(['L12']);
    jobs.length = 0;
    await startGeneration(database.db, { unitId, lessonIds: [l12!.id], actor: editor(), enqueue });
    const job = jobs.shift()!;
    const reviews: string[] = [];
    const slow: GenerateJobDeps = {
      ...deps(),
      requestReview: async (lessonId) => void reviews.push(lessonId),
      // While the model works, the sweep gives the Lesson up.
      clientFor: (context) => ({
        mode: 'fake',
        model: 'fake',
        async complete() {
          await setLessonStatusById(database.db, l12!.id, 'generation-failed');
          return { text: JSON.stringify(placeholderOutput(context.outline)), model: 'fake', stopReason: 'end_turn', usage: NO_USAGE, durationMs: 0 };
        },
      }),
    };

    await handleGenerateJob(slow, job, { finalAttempt: true });

    expect((await lessonsByKey(['L12']))[0]!.status).toBe('generation-failed');
    expect(await readLessonContent(database.db, l12!.id)).toBeUndefined();
    const attempts = await database.db.select().from(schema.generationAttempts).where(eq(schema.generationAttempts.lessonId, l12!.id));
    expect(attempts).toMatchObject([{ outcome: 'succeeded' }]);
    expect(reviews).toEqual([]);
  });
});

describe('regenerating a Flex Day', () => {
  // LCG-14 regression. Found by: Phase 3 spec review (a regenerated Flex Day skipped the wait for its Arc).
  it('LCG-14: waits until the Lessons of its Arc being regenerated have content, keeping its instructions', async () => {
    const [l36, f5] = await lessonsByKey(['L36', 'F5']);
    jobs.length = 0;
    await regenerateLesson(database.db, { lessonId: l36!.id, actor: editor(), enqueue });
    await regenerateLesson(database.db, { lessonId: f5!.id, actor: editor(), instructions: 'More reteaching', enqueue });
    expect(jobs.map((j) => j.lessonId)).toEqual([l36!.id]);

    await handleGenerateJob(deps(), jobs.shift()!, { finalAttempt: true });
    expect(jobs).toMatchObject([{ lessonId: f5!.id, extraInstructions: 'More reteaching' }]);
    await drain(deps());
    expect((await lessonsByKey(['F5']))[0]!.status).toBe('draft');
  });
});

describe('a trial batch', () => {
  it('queues only the first few Outlined Lessons, never Flex Days', async () => {
    jobs.length = 0;
    const result = await startGeneration(database.db, { unitId, trial: true, actor: editor(), enqueue });
    expect(result.queued).toBe(3);
    const queued = await database.db
      .select({ key: schema.lessons.key })
      .from(schema.lessons)
      .where(and(eq(schema.lessons.unitId, unitId), eq(schema.lessons.status, 'queued')))
      .orderBy(asc(schema.lessons.position));
    expect(queued.map((l) => l.key)).toEqual(['L3', 'L4', 'L8']);
  });
});

describe('Quality Checks', () => {
  it('stores rule results with the generated content, requests a review, and stores its results', async () => {
    const [l10] = await lessonsByKey(['L10']);
    jobs.length = 0;
    await startGeneration(database.db, { unitId, lessonIds: [l10!.id], actor: editor(), enqueue });
    const reviews: string[] = [];
    await drain({ ...deps(), requestReview: async (lessonId) => void reviews.push(lessonId) });
    expect(reviews).toEqual([l10!.id]);

    const rules = (await lessonChecks(database.db, l10!.id)).filter((r) => r.source === 'rule');
    expect(rules.map((r) => r.checkId)).toContain('focus-standards-taught');
    expect(rules.find((r) => r.checkId === 'pacing')).toMatchObject({ outcome: 'pass' });

    await handleReviewJob(
      {
        db: database.db,
        clientFor: () =>
          createFakeClient(() =>
            JSON.stringify({
              standards: [{ code: 'RL.6.1', verdict: 'not-taught', reason: 'No Activity cites the text.' }],
              anchorText: { verdict: 'uses', reason: 'Chapter 4.' },
            }),
          ),
      },
      { lessonId: l10!.id },
    );
    const ai = (await lessonChecks(database.db, l10!.id)).filter((r) => r.source === 'ai-review');
    expect(ai.find((r) => r.message.startsWith('RL.6.1'))).toMatchObject({ outcome: 'fail' });
    expect(ai.find((r) => r.checkId === 'ai-anchor-text')).toMatchObject({ outcome: 'pass' });
  });

  it('skips the review of a Lesson that has no content yet', async () => {
    const [l11] = await lessonsByKey(['L11']);
    await handleReviewJob({ db: database.db, clientFor: () => createFakeClient(() => 'unused') }, { lessonId: l11!.id });
    expect(await lessonChecks(database.db, l11!.id)).toEqual([]);
  });
});
