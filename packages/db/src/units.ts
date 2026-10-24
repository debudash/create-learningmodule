import type { ConfirmedImport } from '@lcg/outline';
import { arcs, guidanceVersions, lessons, units, type OutlineSource } from './schema.js';
import type { Database } from './client.js';

export interface ImportUnitInput {
  confirmed: ConfirmedImport;
  source: OutlineSource;
  actorId: string;
  /** Generation Guidance version 1 for the new Unit. */
  guidance: string;
}

/**
 * Creates a Unit, its Arcs, its Lessons (all Outlined) and Generation Guidance v1
 * from a confirmed import, in one transaction. Returns the new Unit's id.
 */
export async function importUnit(db: Database, input: ImportUnitInput): Promise<string> {
  const { confirmed, source, actorId, guidance } = input;
  return db.transaction(async (tx) => {
    const [unit] = await tx
      .insert(units)
      .values({
        title: confirmed.unit.title,
        grade: confirmed.unit.grade,
        unitNumber: confirmed.unit.unitNumber,
        anchorText: confirmed.unit.anchorText,
        performanceTask: confirmed.unit.performanceTask ?? null,
        outlineSource: source,
        importIssues: confirmed.issues,
        createdBy: actorId,
      })
      .returning({ id: units.id });

    const arcRows = await tx
      .insert(arcs)
      .values(
        confirmed.arcs.map((arc) => ({
          unitId: unit!.id,
          key: arc.key,
          name: arc.name,
          position: arc.position,
          description: arc.description,
          performanceTaskSkills: arc.performanceTaskSkills ?? null,
          flexDescription: arc.flexDescription ?? null,
        })),
      )
      .returning({ id: arcs.id, key: arcs.key });
    const arcId = new Map(arcRows.map((a) => [a.key, a.id]));

    await tx.insert(lessons).values(
      confirmed.lessons.map((lesson) => ({
        unitId: unit!.id,
        arcId: arcId.get(lesson.arcKey)!,
        key: lesson.key,
        position: lesson.position,
        lessonNumber: lesson.lessonNumber ?? null,
        lessonType: lesson.lessonType,
        title: lesson.title,
        status: 'outlined' as const,
        outline: lesson,
      })),
    );

    await tx.insert(guidanceVersions).values({ unitId: unit!.id, version: 1, text: guidance, authorId: actorId });
    return unit!.id;
  });
}
