import { z } from 'zod';
import { LESSON_TYPES } from './lesson-type.js';
import { sectionPlanProblems } from './section-plan.js';

/**
 * Lesson JSON: the canonical content of a Lesson (ADR 0001). The AI generates it,
 * Lesson Versions and exports store it, and the editor document converts to and
 * from it without loss.
 *
 * Text fields hold plain text with two inline marks written as Markdown:
 * **bold** and *italic*.
 */
export const LESSON_SCHEMA_VERSION = 1;

const text = z.string();
const standardCodes = z.array(z.string());

/** A block that only teachers see. */
export const TEACHER_ONLY = 'teacher';
/** A block that teachers and students both see. */
export const SHARED = 'shared';
export const audience = z.enum([TEACHER_ONLY, SHARED]);
export type Audience = z.infer<typeof audience>;

export const TEACHER_MOVES = ['say', 'ask', 'teach'] as const;

export const blockSchema = z.discriminatedUnion('type', [
  /** Instructions students follow ("Directions: ..."). */
  z.object({ type: z.literal('directions'), text }),
  /** Points students to a Lesson Text and the part of it the Activity uses. */
  z.object({ type: z.literal('text-reference'), title: z.string().min(1), pages: z.string().optional() }),
  /** Ordinary content: a question, a prompt, a passage. */
  z.object({ type: z.literal('paragraph'), audience, text }),
  /** Scripted teacher speech: Say / Ask / Teach. */
  z.object({ type: z.literal('teacher-script'), move: z.enum(TEACHER_MOVES), text }),
  /** An exemplar answer a teacher listens for. */
  z.object({ type: z.literal('sample-response'), text }),
  /** Pacing notes, cautions and Teacher Tips. */
  z.object({ type: z.literal('teacher-note'), variant: z.enum(['note', 'tip']), text }),
  /** A quick comprehension question with one correct choice and a rationale per choice. */
  z.object({
    type: z.literal('pulse-check'),
    standards: standardCodes,
    stem: text,
    choices: z
      .array(z.object({ text, correct: z.boolean(), rationale: text }))
      .min(2)
      .max(6),
  }),
  /** Integrated ELD Instructions for the Activity it sits in. */
  z.object({
    type: z.literal('eld-panel'),
    purpose: text,
    sayAsk: text,
    watchFor: text,
  }),
  /** Additional Student Support: what to try when a student is struggling or ready for more. */
  z.object({
    type: z.literal('support-table'),
    rows: z.array(z.object({ situation: text, tryThis: text })).min(1),
  }),
])
  // LCG-4: choices were validated one by one, so a Pulse Check with no correct
  // choice, or several, passed as valid Lesson JSON (and AI output could arrive that
  // way). The block as a whole now must have exactly one correct choice.
  .superRefine((block, ctx) => {
    if (block.type === 'pulse-check' && block.choices.filter((c) => c.correct).length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['choices'],
        message: 'A Pulse Check needs exactly one correct choice.',
      });
    }
  });
export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block['type'];

/** Blocks only teachers see; the Student View removes them. */
export const TEACHER_ONLY_BLOCKS: ReadonlySet<BlockType> = new Set([
  'teacher-script',
  'sample-response',
  'teacher-note',
  'eld-panel',
  'support-table',
]);

export const activitySchema = z.object({
  /** Stable within the Lesson, so Quality Checks and AI Suggestions can point at it. */
  id: z.string().min(1),
  title: text,
  minutes: z.number().int().min(0).max(60),
  /** Standards this Activity teaches. */
  standards: standardCodes,
  /** The classroom routine it uses, e.g. "Turn and Talk", "Quick Write". */
  routine: z.string().optional(),
  blocks: z.array(blockSchema),
});
export type Activity = z.infer<typeof activitySchema>;

export const SECTION_KINDS = [
  'launch',
  'literacy-lab',
  'learning-in-action',
  'look-back',
  'homework',
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const SECTION_TITLES: Record<SectionKind, string> = {
  launch: 'Launch',
  'literacy-lab': 'Literacy Lab',
  'learning-in-action': 'Learning in Action',
  'look-back': 'Look Back',
  homework: 'Homework',
};

export const sectionSchema = z.object({
  kind: z.enum(SECTION_KINDS),
  title: text,
  /** Why this part of the Lesson exists; teachers only. */
  purpose: text,
  activities: z.array(activitySchema),
});
export type Section = z.infer<typeof sectionSchema>;

export const OBJECTIVE_KINDS = ['content', 'language', 'foundational-skills'] as const;

export const lessonHeaderSchema = z.object({
  focusStandards: standardCodes,
  supportingStandards: standardCodes,
  eldStandards: standardCodes,
  mediaLiteracyStandards: standardCodes,
  /** Teacher wording ("Students will ..."); the Student View drops the prefix. */
  objectives: z.array(z.object({ kind: z.enum(OBJECTIVE_KINDS), text })),
  essentialQuestions: z.array(text),
  connections: z.object({
    knowledgeBuilding: text,
    enduringUnderstanding: text,
    futureLessons: text,
    performanceTask: text,
  }),
  vocabulary: z.array(
    z.object({
      word: z.string(),
      definition: text,
      /** "addressed" words are taught; "support" words are glossed for access. */
      tier: z.enum(['addressed', 'support']),
    }),
  ),
  texts: z.array(z.object({ title: z.string(), author: z.string().optional(), pages: z.string().optional() })),
});
export type LessonHeader = z.infer<typeof lessonHeaderSchema>;

export const lessonSchema = z.object({
  schemaVersion: z.literal(LESSON_SCHEMA_VERSION),
  title: z.string().min(1),
  lessonType: z.enum(LESSON_TYPES),
  header: lessonHeaderSchema,
  sections: z.array(sectionSchema).min(1),
})
  // LCG-5: any array of Sections was a valid Lesson, so a client that bypassed the
  // editor's structure guard could delete or reorder Sections and the server would
  // store it. A Lesson's Sections must now follow its Lesson Type's plan.
  .superRefine((lesson, ctx) => {
    for (const message of sectionPlanProblems(lesson.lessonType, lesson.sections.map((s) => s.kind))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sections'], message });
    }
  });
export type Lesson = z.infer<typeof lessonSchema>;
