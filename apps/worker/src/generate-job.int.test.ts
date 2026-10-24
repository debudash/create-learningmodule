import {
  cancelGeneration,
  readLessonContent,
  regenerateLesson,
  replaceLessonContent,
  schema,
  startGeneration,
  type EnqueueGeneration,
} from '@lcg/db';
import { freshDatabase, importSampleUnit, type TestDatabase } from '@lcg/db/testing';
import { createFakeClient, placeholderOutput, type LlmRequest } from '@lcg/generation';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handleGenerateJob, type GenerateJob, type GenerateJobDeps } from './generate-job.js';

let database: TestDatabase;
let unitId: string;
const jobs: GenerateJob[] = [];
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
    expect(attempts).toMatchObject([{ outcome: 'succeeded', mode: 'fake', promptVersion: 1 }]);

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
