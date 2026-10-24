import { NO_CHECKS, type CheckCounts, type LessonStatus } from '@lcg/domain';
import type { LessonType } from '@lcg/lesson-schema';
import type { OutlineLesson } from '@lcg/outline';
import { and, asc, count, desc, eq, sql, sum } from 'drizzle-orm';
import { checkCounts } from './checks.js';
import type { Executor } from './client.js';
import { aiReviews, arcs, generationAttempts, guidanceVersions, lessons, units, users, workflowEvents } from './schema.js';

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
  transitionCount: number;
  arcId: string;
  assigneeId: string | null;
  assigneeName: string | null;
  /** A Queued Flex Day without a job is waiting for the rest of its Arc. */
  waitingForArc: boolean;
  /** Why the latest Generation Attempt failed, when the Lesson is Generation Failed. */
  failureReason: string | null;
  /** Current Quality Check results, by outcome. */
  checks: CheckCounts;
}

export interface UnitBoard {
  unit: typeof units.$inferSelect;
  arcs: (typeof arcs.$inferSelect)[];
  lessons: BoardLesson[];
  /** What generating and reviewing this Unit has cost so far (live calls only), in US dollars. */
  aiCostUsd: number;
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
      transitionCount: lessons.transitionCount,
      arcId: lessons.arcId,
      assigneeId: lessons.assigneeId,
      assigneeName: users.name,
      jobEnqueuedAt: lessons.jobEnqueuedAt,
      failureReason: sql<string | null>`(
        SELECT ${workflowEvents.reason} FROM ${workflowEvents}
        WHERE ${workflowEvents.lessonId} = ${lessons.id} AND ${workflowEvents.toStatus} = 'generation-failed'
        ORDER BY ${workflowEvents.createdAt} DESC LIMIT 1)`,
    })
    .from(lessons)
    .leftJoin(users, eq(users.id, lessons.assigneeId))
    .where(eq(lessons.unitId, unitId))
    .orderBy(asc(lessons.position));
  // Only live calls cost money now; a replay records what its original run cost.
  const [generationCost] = await db
    .select({ total: sum(generationAttempts.costUsd) })
    .from(generationAttempts)
    .innerJoin(lessons, eq(lessons.id, generationAttempts.lessonId))
    .where(and(eq(lessons.unitId, unitId), eq(generationAttempts.mode, 'live')));
  const [reviewCost] = await db
    .select({ total: sum(aiReviews.costUsd) })
    .from(aiReviews)
    .innerJoin(lessons, eq(lessons.id, aiReviews.lessonId))
    .where(and(eq(lessons.unitId, unitId), eq(aiReviews.mode, 'live')));
  const counts = await checkCounts(db, lessonRows.map((l) => l.id));
  return {
    unit,
    arcs: arcRows,
    lessons: lessonRows.map(({ jobEnqueuedAt, failureReason, ...lesson }) => ({
      ...lesson,
      checks: counts.get(lesson.id) ?? NO_CHECKS,
      waitingForArc: lesson.status === 'queued' && lesson.lessonType === 'flex-day' && jobEnqueuedAt === null,
      failureReason: lesson.status === 'generation-failed' ? failureReason : null,
    })),
    aiCostUsd: Number(generationCost?.total ?? 0) + Number(reviewCost?.total ?? 0),
  };
}

export interface WorkspaceLesson {
  id: string;
  key: string;
  title: string;
  status: LessonStatus;
  transitionCount: number;
  lessonType: LessonType;
  outline: OutlineLesson;
  assignee: { id: string; name: string } | null;
  /** People who edited the Lesson since it was last generated. */
  editorIds: string[];
  /** When the Lesson is Changes Requested: who asked, and why. */
  changesRequested: { by: string | null; reason: string | null } | null;
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
      assigneeName: users.name,
      changesReason: sql<string | null>`(
        SELECT ${workflowEvents.reason} FROM ${workflowEvents}
        WHERE ${workflowEvents.lessonId} = ${lessons.id} AND ${workflowEvents.toStatus} = 'changes-requested'
        ORDER BY ${workflowEvents.createdAt} DESC LIMIT 1)`,
      changesBy: sql<string | null>`(
        SELECT u.name FROM ${workflowEvents} e JOIN users u ON u.id = e.actor_id
        WHERE e.lesson_id = ${lessons.id} AND e.to_status = 'changes-requested'
        ORDER BY e.created_at DESC LIMIT 1)`,
    })
    .from(lessons)
    .innerJoin(units, eq(units.id, lessons.unitId))
    .innerJoin(arcs, eq(arcs.id, lessons.arcId))
    .leftJoin(users, eq(users.id, lessons.assigneeId))
    .where(eq(lessons.id, lessonId));
  if (!row) return undefined;
  const { lesson } = row;
  return {
    id: lesson.id,
    key: lesson.key,
    title: lesson.title,
    status: lesson.status,
    transitionCount: lesson.transitionCount,
    lessonType: lesson.lessonType,
    outline: lesson.outline,
    assignee: lesson.assigneeId && row.assigneeName ? { id: lesson.assigneeId, name: row.assigneeName } : null,
    editorIds: lesson.editorIds,
    changesRequested:
      lesson.status === 'changes-requested' ? { by: row.changesBy, reason: row.changesReason } : null,
    unit: row.unit,
    arc: row.arc,
  };
}

export async function listUsers(db: Executor) {
  return db.select().from(users).orderBy(asc(users.role), asc(users.name));
}

export interface GuidanceVersion {
  id: string;
  version: number;
  text: string;
  authorName: string;
  createdAt: Date;
}

/** A Unit's Generation Guidance versions, newest first. */
export async function guidanceHistory(db: Executor, unitId: string): Promise<GuidanceVersion[]> {
  return db
    .select({
      id: guidanceVersions.id,
      version: guidanceVersions.version,
      text: guidanceVersions.text,
      authorName: users.name,
      createdAt: guidanceVersions.createdAt,
    })
    .from(guidanceVersions)
    .innerJoin(users, eq(users.id, guidanceVersions.authorId))
    .where(eq(guidanceVersions.unitId, unitId))
    .orderBy(desc(guidanceVersions.version));
}

/** Saves edited Generation Guidance as the Unit's next version; unchanged text saves nothing. */
export async function saveGuidance(
  db: Executor,
  input: { unitId: string; text: string; authorId: string },
): Promise<{ ok: true; version: number } | { ok: false; message: string }> {
  if (!input.text.trim()) return { ok: false, message: 'Generation Guidance cannot be empty.' };
  const [latest] = await guidanceHistory(db, input.unitId);
  if (latest && latest.text === input.text) return { ok: true, version: latest.version };
  const version = (latest?.version ?? 0) + 1;
  await db.insert(guidanceVersions).values({ unitId: input.unitId, version, text: input.text, authorId: input.authorId });
  return { ok: true, version };
}
