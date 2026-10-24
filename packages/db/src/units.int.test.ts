import { confirmImport, parseOutlineCsv, type Resolution } from '@lcg/outline';
import { sampleOutlineCsv } from '@lcg/outline/testing';
import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { arcs, guidanceVersions, lessons, units } from './schema.js';
import { freshDatabase } from './testing.js';
import { importUnit } from './units.js';

const SAMPLE = sampleOutlineCsv();

let database: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  database = await freshDatabase();
});
afterAll(() => database.close());

function confirmedSample() {
  const proposal = parseOutlineCsv(SAMPLE);
  const resolutions: Resolution[] = proposal.issues
    .filter((i) => i.severity === 'blocking')
    .map((i) => ({ issueId: i.id, action: 'accept-suggestion' }));
  const result = confirmImport(proposal, resolutions);
  if (!result.ok) throw new Error(result.errors.join('; '));
  return result.confirmed;
}

describe('importUnit', () => {
  it('creates the Unit, its Arcs, 47 Outlined Lessons and Guidance v1 together', async () => {
    const { db, editorId } = database;
    const unitId = await importUnit(db, {
      confirmed: confirmedSample(),
      source: { kind: 'google-sheets', reference: 'https://docs.google.com/spreadsheets/d/x' },
      actorId: editorId,
      guidance: 'Default guidance',
    });

    const [unit] = await db.select().from(units).where(eq(units.id, unitId));
    expect(unit).toMatchObject({ grade: 6, unitNumber: 4, performanceTask: 'Shared Stories, Shared Lessons' });
    expect(unit!.importIssues.some((i) => i.resolution === 'accept-suggestion')).toBe(true);

    const arcRows = await db.select().from(arcs).where(eq(arcs.unitId, unitId)).orderBy(asc(arcs.position));
    expect(arcRows.map((a) => a.name)).toEqual(['Spark', 'Investigation 1', 'Investigation 2', 'Showcase']);

    const lessonRows = await db
      .select()
      .from(lessons)
      .where(eq(lessons.unitId, unitId))
      .orderBy(asc(lessons.position));
    expect(lessonRows).toHaveLength(47);
    expect(new Set(lessonRows.map((l) => l.status))).toEqual(new Set(['outlined']));
    expect(lessonRows[2]).toMatchObject({ key: 'L3', title: 'Rick Riordan as a Myth Adapter' });
    expect(lessonRows.find((l) => l.key === 'F1')!.arcId).toBe(arcRows[1]!.id);

    const guidance = await db.select().from(guidanceVersions).where(eq(guidanceVersions.unitId, unitId));
    expect(guidance).toMatchObject([{ version: 1, text: 'Default guidance' }]);
  });

  it('leaves nothing behind when any insert fails', async () => {
    const { db } = database;
    const before = await db.select({ id: units.id }).from(units);
    await expect(
      importUnit(db, {
        confirmed: confirmedSample(),
        source: { kind: 'file', reference: 'x.csv' },
        actorId: '00000000-0000-0000-0000-000000000000',
        guidance: 'g',
      }),
    ).rejects.toThrow();
    expect(await db.select({ id: units.id }).from(units)).toEqual(before);
  });
});
