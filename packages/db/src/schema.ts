import { LESSON_STATUSES, ROLES, VERSION_REASONS } from '@lcg/domain';
import { LESSON_TYPES } from '@lcg/lesson-schema';
import type { AnchorText, OutlineLesson, ResolvedIssue } from '@lcg/outline';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => 'bytea',
  toDriver: (value) => Buffer.from(value),
  fromDriver: (value) => new Uint8Array(value),
});

const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: id(),
  name: text('name').notNull(),
  role: text('role', { enum: ROLES }).notNull(),
});

/** Where a Unit's Outline came from. */
export interface OutlineSource {
  kind: 'google-sheets' | 'file';
  /** The link or the uploaded file name. */
  reference: string;
}

export const units = pgTable('units', {
  id: id(),
  title: text('title').notNull(),
  grade: integer('grade').notNull(),
  unitNumber: integer('unit_number').notNull(),
  anchorText: jsonb('anchor_text').$type<AnchorText>().notNull(),
  performanceTask: text('performance_task'),
  outlineSource: jsonb('outline_source').$type<OutlineSource>().notNull(),
  /** Every Outline Issue found at import and how it was resolved. */
  importIssues: jsonb('import_issues').$type<ResolvedIssue[]>().notNull(),
  latestReleaseId: uuid('latest_release_id').references((): AnyPgColumn => unitReleases.id, {
    onDelete: 'set null',
  }),
  hasUnpublishedChanges: boolean('has_unpublished_changes').notNull().default(false),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
});

export const arcs = pgTable(
  'arcs',
  {
    id: id(),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    description: text('description').notNull(),
    performanceTaskSkills: text('performance_task_skills'),
    flexDescription: text('flex_description'),
  },
  (t) => [uniqueIndex('arcs_unit_key').on(t.unitId, t.key)],
);

export const guidanceVersions = pgTable(
  'guidance_versions',
  {
    id: id(),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    text: text('text').notNull(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('guidance_unit_version').on(t.unitId, t.version)],
);

/** Short summary of a generated Lesson, used by later Lessons in its Arc (Flex Days). */
export interface LessonDigest {
  summary: string;
  keyActivities: string[];
  vocabularyTaught: string[];
  standardsCovered: string[];
}

export const lessons = pgTable(
  'lessons',
  {
    id: id(),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),
    arcId: uuid('arc_id')
      .notNull()
      .references(() => arcs.id),
    key: text('key').notNull(),
    position: integer('position').notNull(),
    lessonNumber: integer('lesson_number'),
    lessonType: text('lesson_type', { enum: LESSON_TYPES }).notNull(),
    title: text('title').notNull(),
    status: text('status', { enum: LESSON_STATUSES }).notNull(),
    /** Incremented on every status change; a transition names the count it expects (optimistic concurrency). */
    transitionCount: integer('transition_count').notNull().default(0),
    assigneeId: uuid('assignee_id').references(() => users.id),
    /** The confirmed Outline row this Lesson was generated from. */
    outline: jsonb('outline').$type<OutlineLesson>().notNull(),
    digest: jsonb('digest').$type<LessonDigest>(),
    /** Users who have edited the Lesson since it was last generated (for Self-Approval). */
    editorIds: uuid('editor_ids').array().notNull().default(sql`'{}'::uuid[]`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('lessons_unit_key').on(t.unitId, t.key),
    index('lessons_unit_position').on(t.unitId, t.position),
  ],
);

/** Live Yjs state of a Lesson, written by the collaboration server. */
export const lessonDocuments = pgTable('lesson_documents', {
  lessonId: uuid('lesson_id')
    .primaryKey()
    .references(() => lessons.id, { onDelete: 'cascade' }),
  state: bytea('state').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const lessonVersions = pgTable(
  'lesson_versions',
  {
    id: id(),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    reason: text('reason', { enum: VERSION_REASONS }).notNull(),
    /** Lesson content as Lesson JSON; never modified after insert. */
    content: jsonb('content').notNull(),
    actorId: uuid('actor_id').references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('lesson_versions_number').on(t.lessonId, t.number)],
);

export const workflowEvents = pgTable(
  'workflow_events',
  {
    id: id(),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id),
    action: text('action').notNull(),
    fromStatus: text('from_status', { enum: LESSON_STATUSES }),
    toStatus: text('to_status', { enum: LESSON_STATUSES }).notNull(),
    reason: text('reason'),
    selfApproval: boolean('self_approval').notNull().default(false),
    overFailingChecks: boolean('over_failing_checks').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('workflow_events_lesson').on(t.lessonId, t.createdAt)],
);

export const generationAttempts = pgTable(
  'generation_attempts',
  {
    id: id(),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    guidanceVersionId: uuid('guidance_version_id').references(() => guidanceVersions.id),
    extraInstructions: text('extra_instructions'),
    model: text('model').notNull(),
    mode: text('mode', { enum: ['live', 'replay', 'fake'] }).notNull(),
    outcome: text('outcome', { enum: ['succeeded', 'repaired', 'failed'] }).notNull(),
    /** Why the attempt failed, in words a person can act on. */
    failureReason: text('failure_reason'),
    /** Where the model's output broke the Lesson JSON schema, if it did. */
    schemaViolations: jsonb('schema_violations').$type<string[]>(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
    cacheWriteTokens: integer('cache_write_tokens').notNull().default(0),
    costUsd: numeric('cost_usd', { precision: 10, scale: 4 }).notNull().default('0'),
    durationMs: integer('duration_ms').notNull(),
    rawOutput: text('raw_output'),
    createdAt: createdAt(),
  },
  (t) => [index('generation_attempts_lesson').on(t.lessonId, t.createdAt)],
);

export const qualityCheckResults = pgTable(
  'quality_check_results',
  {
    id: id(),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    checkId: text('check_id').notNull(),
    source: text('source', { enum: ['rule', 'ai-review'] }).notNull(),
    outcome: text('outcome', { enum: ['pass', 'warn', 'fail'] }).notNull(),
    message: text('message').notNull(),
    /** Where in the Lesson document the result points (block id), if anywhere. */
    location: text('location'),
    createdAt: createdAt(),
  },
  (t) => [index('quality_check_results_lesson').on(t.lessonId)],
);

export const aiSuggestions = pgTable('ai_suggestions', {
  id: id(),
  lessonId: uuid('lesson_id')
    .notNull()
    .references(() => lessons.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id')
    .notNull()
    .references(() => users.id),
  action: text('action').notNull(),
  outcome: text('outcome', { enum: ['pending', 'accepted', 'rejected'] }).notNull(),
  createdAt: createdAt(),
});

export const unitReleases = pgTable(
  'unit_releases',
  {
    id: id(),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    publisherId: uuid('publisher_id')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('unit_releases_number').on(t.unitId, t.number)],
);

export const releaseEntries = pgTable(
  'release_entries',
  {
    releaseId: uuid('release_id')
      .notNull()
      .references(() => unitReleases.id, { onDelete: 'cascade' }),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id),
    lessonVersionId: uuid('lesson_version_id')
      .notNull()
      .references(() => lessonVersions.id),
  },
  (t) => [primaryKey({ columns: [t.releaseId, t.lessonId] })],
);
