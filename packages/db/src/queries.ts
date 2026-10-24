import type { LessonStatus } from '@lcg/domain';
import type { LessonType } from '@lcg/lesson-schema';
import type { OutlineLesson } from '@lcg/outline';
import { asc, count, eq } from 'drizzle-orm';
import type { Executor } from './client.js';
import { arcs, lessons, units, users } from './schema.js';

export interface UnitSummary {
  id: string;
  title: string;
  grade: number;
  unitNumber: number;
  anchorTitle: string;
  lessonCount: number;
  statusCounts: Partial<Record<LessonStatus, number>>;
  hasUnpublishedChanges: boolean;
  published: boolean;
}

export async function listUnits(db: Executor): Promise<UnitSummary[]> {
  const unitRows = await db.select().from(units).orderBy(asc(units.grade), asc(units.unitNumber));
  const counts = await db
    .select({ unitId: lessons.unitId, status: lessons.status, n: count() })
    .from(lessons)
    .groupBy(lessons.unitId, lessons.status);

  return unitRows.map((unit) => {
    const statusCounts: Partial<Record<LessonStatus, number>> = {};
    for (const c of counts.filter((c) => c.unitId === unit.id)) statusCounts[c.status] = c.n;
    return {
      id: unit.id,
      title: unit.title,
      grade: unit.grade,
      unitNumber: unit.unitNumber,
      anchorTitle: unit.anchorText.title,
      lessonCount: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      statusCounts,
      hasUnpublishedChanges: unit.hasUnpublishedChanges,
      published: unit.latestReleaseId !== null,
    };
  });
}

export interface BoardLesson {
  id: string;
  key: string;
  position: number;
  lessonNumber: number | null;
  title: string;
  lessonType: LessonType;
  status: LessonStatus;
  arcId: string;
  assigneeName: string | null;
}

export interface UnitBoard {
  unit: typeof units.$inferSelect;
  arcs: (typeof arcs.$inferSelect)[];
  lessons: BoardLesson[];
}

/** A Unit with its Arcs and Lessons in Outline order, for the Unit board. */
export async function unitBoard(db: Executor, unitId: string): Promise<UnitBoard | undefined> {
  const [unit] = await db.select().from(units).where(eq(units.id, unitId));
  if (!unit) return undefined;
  const arcRows = await db.select().from(arcs).where(eq(arcs.unitId, unitId)).orderBy(asc(arcs.position));
  const lessonRows = await db
    .select({
      id: lessons.id,
      key: lessons.key,
      position: lessons.position,
      lessonNumber: lessons.lessonNumber,
      title: lessons.title,
      lessonType: lessons.lessonType,
      status: lessons.status,
      arcId: lessons.arcId,
      assigneeName: users.name,
    })
    .from(lessons)
    .leftJoin(users, eq(users.id, lessons.assigneeId))
    .where(eq(lessons.unitId, unitId))
    .orderBy(asc(lessons.position));
  return { unit, arcs: arcRows, lessons: lessonRows };
}

export interface WorkspaceLesson {
  id: string;
  key: string;
  title: string;
  status: LessonStatus;
  revision: number;
  lessonType: LessonType;
  outline: OutlineLesson;
  unit: { id: string; title: string; grade: number; unitNumber: number };
  arc: { name: string };
}

/** One Lesson with the context the Lesson workspace shows beside the editor. */
export async function workspaceLesson(db: Executor, lessonId: string): Promise<WorkspaceLesson | undefined> {
  const [row] = await db
    .select({
      lesson: lessons,
      unit: { id: units.id, title: units.title, grade: units.grade, unitNumber: units.unitNumber },
      arc: { name: arcs.name },
    })
    .from(lessons)
    .innerJoin(units, eq(units.id, lessons.unitId))
    .innerJoin(arcs, eq(arcs.id, lessons.arcId))
    .where(eq(lessons.id, lessonId));
  if (!row) return undefined;
  const { lesson } = row;
  return {
    id: lesson.id,
    key: lesson.key,
    title: lesson.title,
    status: lesson.status,
    revision: lesson.revision,
    lessonType: lesson.lessonType,
    outline: lesson.outline,
    unit: row.unit,
    arc: row.arc,
  };
}

export async function listUsers(db: Executor) {
  return db.select().from(users).orderBy(asc(users.role), asc(users.name));
}
