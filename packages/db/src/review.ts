import { isEditable, parseReviewAction, publishability, type Actor, type ReviewAction } from '@lcg/domain';
import type { Lesson, LessonType } from '@lcg/lesson-schema';
import { and, asc, count, desc, eq, inArray, max } from 'drizzle-orm';
import type { Database, Executor } from './client.js';
import { readLessonContent, replaceLessonContent } from './documents.js';
import { captureVersion } from './generation.js';
import {
  generationAttempts,
  guidanceVersions,
  lessons,
  lessonVersions,
  releaseEntries,
  unitReleases,
  units,
  users,
  workflowEvents,
} from './schema.js';
import { transitionLesson, type TransitionResult } from './workflow.js';

/**
 * Applies a review action: the status change (with its workflow event), plus the
 * Lesson Version it captures. Submitting and approving freeze the content at that
 * moment; reopening a Lesson of a Published Unit marks the Unit as having
 * Unpublished Changes.
 */
export async function applyReviewAction(
  db: Database,
  input: { lessonId: string; actor: Actor; action: ReviewAction; expectedTransitionCount?: number },
): Promise<TransitionResult> {
  const action = parseReviewAction(input.action);
  if (!action) return { ok: false, refusal: 'not-permitted', message: 'That is not a review action.' };
  return db.transaction(async (tx) => {
    const result = await transitionLesson(tx, { ...input, action });
    if (!result.ok) return result;
    const actorId = input.actor.kind === 'user' ? input.actor.id : undefined;
    const freeze = async (reason: 'submitted' | 'approved') => {
      const content = await readLessonContent(tx, input.lessonId);
      if (content) await captureVersion(tx, { lessonId: input.lessonId, reason, content, ...(actorId ? { actorId } : {}) });
    };
    if (action.type === 'submit') await freeze('submitted');
    if (action.type === 'approve') await freeze('approved');
    if (action.type === 'reopen') await markUnpublishedChanges(tx, input.lessonId);
    return result;
  });
}

async function markUnpublishedChanges(tx: Executor, lessonId: string): Promise<void> {
  const [lesson] = await tx.select({ unitId: lessons.unitId }).from(lessons).where(eq(lessons.id, lessonId));
  const [unit] = await tx.select({ latestReleaseId: units.latestReleaseId }).from(units).where(eq(units.id, lesson!.unitId));
  if (unit?.latestReleaseId) await tx.update(units).set({ hasUnpublishedChanges: true }).where(eq(units.id, lesson!.unitId));
}

export interface BulkResult {
  approved: string[];
  refused: { lessonId: string; message: string }[];
}

/** Approves several In Review Lessons; each succeeds or is refused on its own. */
export async function approveLessons(db: Database, input: { lessonIds: string[]; actor: Actor }): Promise<BulkResult> {
  const result: BulkResult = { approved: [], refused: [] };
  for (const lessonId of input.lessonIds) {
    const outcome = await applyReviewAction(db, { lessonId, actor: input.actor, action: { type: 'approve' } });
    if (outcome.ok) result.approved.push(lessonId);
    else result.refused.push({ lessonId, message: outcome.message });
  }
  return result;
}

/** Makes a person the Lesson's Assignee, or clears it. Anyone may claim or release; live editing makes overlap harmless. */
export async function assignLesson(db: Executor, input: { lessonId: string; assigneeId: string | null }): Promise<void> {
  await db.update(lessons).set({ assigneeId: input.assigneeId }).where(eq(lessons.id, input.lessonId));
}

export interface LessonHistory {
  versions: { id: string; number: number; reason: string; actorName: string | null; createdAt: Date }[];
  attempts: {
    createdAt: Date;
    model: string;
    mode: string;
    outcome: string;
    costUsd: number;
    durationMs: number;
    failureReason: string | null;
    extraInstructions: string | null;
    guidanceVersion: number | null;
  }[];
  events: {
    action: string;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    actorName: string | null;
    selfApproval: boolean;
    overFailingChecks: boolean;
    createdAt: Date;
  }[];
}

/** Everything that happened to a Lesson, newest first, for the workspace's History tab. */
export async function lessonHistory(db: Executor, lessonId: string): Promise<LessonHistory> {
  const versions = await db
    .select({
      id: lessonVersions.id,
      number: lessonVersions.number,
      reason: lessonVersions.reason,
      actorName: users.name,
      createdAt: lessonVersions.createdAt,
    })
    .from(lessonVersions)
    .leftJoin(users, eq(users.id, lessonVersions.actorId))
    .where(eq(lessonVersions.lessonId, lessonId))
    .orderBy(desc(lessonVersions.number));
  const attempts = await db
    .select({
      createdAt: generationAttempts.createdAt,
      model: generationAttempts.model,
      mode: generationAttempts.mode,
      outcome: generationAttempts.outcome,
      costUsd: generationAttempts.costUsd,
      durationMs: generationAttempts.durationMs,
      failureReason: generationAttempts.failureReason,
      extraInstructions: generationAttempts.extraInstructions,
      guidanceVersion: guidanceVersions.version,
    })
    .from(generationAttempts)
    .leftJoin(guidanceVersions, eq(guidanceVersions.id, generationAttempts.guidanceVersionId))
    .where(eq(generationAttempts.lessonId, lessonId))
    .orderBy(desc(generationAttempts.createdAt));
  const events = await db
    .select({
      action: workflowEvents.action,
      fromStatus: workflowEvents.fromStatus,
      toStatus: workflowEvents.toStatus,
      reason: workflowEvents.reason,
      actorName: users.name,
      selfApproval: workflowEvents.selfApproval,
      overFailingChecks: workflowEvents.overFailingChecks,
      createdAt: workflowEvents.createdAt,
    })
    .from(workflowEvents)
    .leftJoin(users, eq(users.id, workflowEvents.actorId))
    .where(eq(workflowEvents.lessonId, lessonId))
    .orderBy(desc(workflowEvents.createdAt));
  return { versions, attempts: attempts.map((a) => ({ ...a, costUsd: Number(a.costUsd) })), events };
}

/** One Lesson Version's content, if it belongs to the Lesson. */
export async function readVersion(db: Executor, lessonId: string, versionId: string): Promise<Lesson | undefined> {
  const [row] = await db
    .select({ content: lessonVersions.content })
    .from(lessonVersions)
    .where(and(eq(lessonVersions.id, versionId), eq(lessonVersions.lessonId, lessonId)));
  return row?.content as Lesson | undefined;
}

export type RestoreResult = { ok: true } | { ok: false; message: string };

/** Makes an earlier Lesson Version the current content again, as a new Version (history is never rewritten). */
export async function restoreVersion(
  db: Database,
  input: { lessonId: string; versionId: string; actor: Actor & { kind: 'user' } },
): Promise<RestoreResult> {
  return db.transaction(async (tx) => {
    const [lesson] = await tx.select({ status: lessons.status }).from(lessons).where(eq(lessons.id, input.lessonId)).for('update');
    if (!lesson || !isEditable(lesson.status)) {
      return { ok: false, message: 'Only a Lesson that is being edited can be restored; Reopen an Approved Lesson first.' };
    }
    const content = await readVersion(tx, input.lessonId, input.versionId);
    if (!content) return { ok: false, message: 'No such Lesson Version.' };
    await replaceLessonContent(tx, input.lessonId, content);
    await captureVersion(tx, { lessonId: input.lessonId, reason: 'restored', content, actorId: input.actor.id });
    return { ok: true };
  });
}

export type PublishResult = { ok: true; releaseNumber: number } | { ok: false; message: string };

/**
 * Publishes a Unit (ADR 0009): when every Lesson is Approved, freezes a Unit Release
 * that points at each Lesson's latest Approved Version. Later edits never change it.
 */
export async function publishUnit(db: Database, input: { unitId: string; actor: Actor & { kind: 'user' } }): Promise<PublishResult> {
  if (input.actor.role !== 'approver') return { ok: false, message: 'Only an Approver can publish a Unit.' };
  return db.transaction(async (tx) => {
    const unitLessons = await tx
      .select({ id: lessons.id, key: lessons.key, status: lessons.status })
      .from(lessons)
      .where(eq(lessons.unitId, input.unitId))
      .orderBy(asc(lessons.position))
      .for('update');
    const ready = publishability(unitLessons);
    if (!ready.ok) return { ok: false, message: ready.message };

    // Each Lesson's latest Approved Version: the first row per Lesson, newest first.
    const approved = await tx
      .select({ id: lessonVersions.id, lessonId: lessonVersions.lessonId })
      .from(lessonVersions)
      .where(and(inArray(lessonVersions.lessonId, unitLessons.map((l) => l.id)), eq(lessonVersions.reason, 'approved')))
      .orderBy(asc(lessonVersions.lessonId), desc(lessonVersions.number));
    const versionFor = new Map<string, string>();
    for (const version of approved) if (!versionFor.has(version.lessonId)) versionFor.set(version.lessonId, version.id);
    if (versionFor.size !== unitLessons.length) {
      return { ok: false, message: 'Some Approved Lessons have no Approved Version to publish.' };
    }

    const [latest] = await tx
      .select({ number: max(unitReleases.number) })
      .from(unitReleases)
      .where(eq(unitReleases.unitId, input.unitId));
    const releaseNumber = (latest?.number ?? 0) + 1;
    const [release] = await tx
      .insert(unitReleases)
      .values({ unitId: input.unitId, number: releaseNumber, publisherId: input.actor.id })
      .returning({ id: unitReleases.id });
    await tx
      .insert(releaseEntries)
      .values(unitLessons.map((l) => ({ releaseId: release!.id, lessonId: l.id, lessonVersionId: versionFor.get(l.id)! })));
    await tx.update(units).set({ latestReleaseId: release!.id, hasUnpublishedChanges: false }).where(eq(units.id, input.unitId));
    return { ok: true, releaseNumber };
  });
}

export interface ReleaseSummary {
  id: string;
  number: number;
  publisherName: string;
  createdAt: Date;
}

export async function listReleases(db: Executor, unitId: string): Promise<ReleaseSummary[]> {
  return db
    .select({ id: unitReleases.id, number: unitReleases.number, publisherName: users.name, createdAt: unitReleases.createdAt })
    .from(unitReleases)
    .innerJoin(users, eq(users.id, unitReleases.publisherId))
    .where(eq(unitReleases.unitId, unitId))
    .orderBy(desc(unitReleases.number));
}

export interface ReleaseExport {
  unit: { id: string; title: string; grade: number; unitNumber: number; performanceTask: string | null };
  release: { number: number; publishedAt: string; publishedBy: string };
  lessons: { key: string; position: number; lessonNumber: number | null; lessonType: LessonType; lesson: Lesson }[];
}

/** A Unit Release as structured JSON, for import into Newsela's product. */
export async function releaseExport(db: Executor, releaseId: string): Promise<ReleaseExport | undefined> {
  const [release] = await db
    .select({
      number: unitReleases.number,
      createdAt: unitReleases.createdAt,
      publisher: users.name,
      unit: { id: units.id, title: units.title, grade: units.grade, unitNumber: units.unitNumber, performanceTask: units.performanceTask },
    })
    .from(unitReleases)
    .innerJoin(units, eq(units.id, unitReleases.unitId))
    .innerJoin(users, eq(users.id, unitReleases.publisherId))
    .where(eq(unitReleases.id, releaseId));
  if (!release) return undefined;
  const entries = await db
    .select({
      key: lessons.key,
      position: lessons.position,
      lessonNumber: lessons.lessonNumber,
      lessonType: lessons.lessonType,
      content: lessonVersions.content,
    })
    .from(releaseEntries)
    .innerJoin(lessons, eq(lessons.id, releaseEntries.lessonId))
    .innerJoin(lessonVersions, eq(lessonVersions.id, releaseEntries.lessonVersionId))
    .where(eq(releaseEntries.releaseId, releaseId))
    .orderBy(asc(lessons.position));
  return {
    unit: release.unit,
    release: { number: release.number, publishedAt: release.createdAt.toISOString(), publishedBy: release.publisher },
    lessons: entries.map(({ content, ...entry }) => ({ ...entry, lesson: content as Lesson })),
  };
}

export interface PublishSummary {
  lessonCount: number;
  /** Lessons whose latest approval was a Self-Approval. */
  selfApproved: string[];
  /** Lessons approved while Quality Checks were failing. */
  approvedOverFailingChecks: string[];
}

/** What an Approver should know before publishing: how the current approvals were given. */
export async function publishSummary(db: Executor, unitId: string): Promise<PublishSummary> {
  const rows = await db
    .selectDistinctOn([workflowEvents.lessonId], {
      key: lessons.key,
      selfApproval: workflowEvents.selfApproval,
      overFailingChecks: workflowEvents.overFailingChecks,
    })
    .from(workflowEvents)
    .innerJoin(lessons, eq(lessons.id, workflowEvents.lessonId))
    .where(and(eq(lessons.unitId, unitId), eq(workflowEvents.action, 'approve'), eq(lessons.status, 'approved')))
    .orderBy(workflowEvents.lessonId, desc(workflowEvents.createdAt));
  const [total] = await db.select({ n: count() }).from(lessons).where(eq(lessons.unitId, unitId));
  return {
    lessonCount: total?.n ?? 0,
    selfApproved: rows.filter((r) => r.selfApproval).map((r) => r.key),
    approvedOverFailingChecks: rows.filter((r) => r.overFailingChecks).map((r) => r.key),
  };
}
