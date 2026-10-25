import type { JSONContent } from '@tiptap/core';
import { inlineToNodes, nodesToInline } from './inline.js';
import {
  LESSON_SCHEMA_VERSION,
  lessonSchema,
  type Activity,
  type Block,
  type Lesson,
  type LessonHeader,
  type Section,
} from './lesson.js';

/** Lesson JSON → the editor document (ProseMirror JSON). */
export function lessonToDocument(lesson: Lesson): JSONContent {
  const { header } = lesson;
  return {
    type: 'doc',
    content: [
      {
        type: 'lessonHeader',
        attrs: { title: lesson.title, lessonType: lesson.lessonType, ...header },
      },
      ...lesson.sections.map(sectionToNode),
    ],
  };
}

function sectionToNode(section: Section): JSONContent {
  return {
    type: 'section',
    attrs: { kind: section.kind, title: section.title, purpose: section.purpose },
    content: section.activities.map(activityToNode),
  };
}

/** One Activity as an editor node, for replacing an Activity in place (an accepted AI Suggestion). */
export function activityToNode(activity: Activity): JSONContent {
  return {
    type: 'activity',
    attrs: {
      id: activity.id,
      title: activity.title,
      minutes: activity.minutes,
      standards: activity.standards,
      routine: activity.routine ?? null,
    },
    content: activity.blocks.map(blockToNode),
  };
}

const withText = (type: string, text: string, attrs?: Record<string, unknown>): JSONContent => {
  const content = inlineToNodes(text);
  return { type, ...(attrs ? { attrs } : {}), ...(content.length > 0 ? { content } : {}) };
};

function blockToNode(block: Block): JSONContent {
  switch (block.type) {
    case 'directions':
      return withText('directions', block.text);
    case 'paragraph':
      return withText('paragraph', block.text, { audience: block.audience });
    case 'teacher-script':
      return withText('teacherScript', block.text, { move: block.move });
    case 'sample-response':
      return withText('sampleResponse', block.text);
    case 'teacher-note':
      return withText('teacherNote', block.text, { variant: block.variant });
    case 'pulse-check':
      return { type: 'pulseCheck', attrs: { standards: block.standards, stem: block.stem, choices: block.choices } };
    case 'eld-panel':
      return { type: 'eldPanel', attrs: { purpose: block.purpose, sayAsk: block.sayAsk, watchFor: block.watchFor } };
    case 'support-table':
      return { type: 'supportTable', attrs: { rows: block.rows } };
    case 'text-reference':
      return { type: 'textReference', attrs: { title: block.title, pages: block.pages ?? '' } };
  }
}

export type DocumentToLessonResult =
  | { ok: true; lesson: Lesson }
  | { ok: false; problems: string[] };

/** The editor document → Lesson JSON, validated against the Lesson schema. */
export function documentToLesson(doc: JSONContent): DocumentToLessonResult {
  const [headerNode, ...sectionNodes] = doc.content ?? [];
  if (headerNode?.type !== 'lessonHeader') return { ok: false, problems: ['The document has no Lesson header.'] };
  const { title, lessonType, ...header } = (headerNode.attrs ?? {}) as Record<string, unknown>;

  const candidate = {
    schemaVersion: LESSON_SCHEMA_VERSION,
    title,
    lessonType,
    header: header as LessonHeader,
    sections: sectionNodes.map((node, s) => nodeToSection(node, s)),
  };
  const parsed = lessonSchema.safeParse(candidate);
  if (parsed.success) return { ok: true, lesson: parsed.data };
  return {
    ok: false,
    problems: parsed.error.issues.map((i) => `${i.path.join('.') || 'lesson'}: ${i.message}`),
  };
}

function nodeToSection(node: JSONContent, sectionIndex: number): Section {
  const attrs = node.attrs ?? {};
  return {
    kind: attrs.kind,
    title: attrs.title ?? '',
    purpose: attrs.purpose ?? '',
    activities: (node.content ?? []).map((a, i) => nodeToActivity(a, `s${sectionIndex + 1}-a${i + 1}`)),
  };
}

function nodeToActivity(node: JSONContent, fallbackId: string): Activity {
  const attrs = node.attrs ?? {};
  return {
    id: attrs.id || fallbackId,
    title: attrs.title ?? '',
    minutes: Number(attrs.minutes ?? 0),
    standards: attrs.standards ?? [],
    ...(attrs.routine ? { routine: attrs.routine } : {}),
    blocks: (node.content ?? []).map(nodeToBlock).filter((b): b is Block => b !== undefined),
  };
}

function nodeToBlock(node: JSONContent): Block | undefined {
  const attrs = node.attrs ?? {};
  const text = nodesToInline(node.content);
  switch (node.type) {
    case 'directions':
      return { type: 'directions', text };
    case 'paragraph':
      return { type: 'paragraph', audience: attrs.audience ?? 'shared', text };
    case 'teacherScript':
      return { type: 'teacher-script', move: attrs.move ?? 'say', text };
    case 'sampleResponse':
      return { type: 'sample-response', text };
    case 'teacherNote':
      return { type: 'teacher-note', variant: attrs.variant ?? 'note', text };
    case 'pulseCheck':
      return { type: 'pulse-check', standards: attrs.standards ?? [], stem: attrs.stem ?? '', choices: attrs.choices ?? [] };
    case 'eldPanel':
      return { type: 'eld-panel', purpose: attrs.purpose ?? '', sayAsk: attrs.sayAsk ?? '', watchFor: attrs.watchFor ?? '' };
    case 'supportTable':
      return { type: 'support-table', rows: attrs.rows ?? [] };
    case 'textReference':
      return { type: 'text-reference', title: attrs.title ?? '', ...(attrs.pages ? { pages: attrs.pages } : {}) };
    default:
      return undefined;
  }
}
