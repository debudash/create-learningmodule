import { getSchema, Mark, Node, type AnyExtension } from '@tiptap/core';
import type { Schema } from '@tiptap/pm/model';

/**
 * The Lesson document schema (ADR 0001) as Tiptap extensions with no UI.
 * The collaboration server and the worker use it through lessonEditorSchema();
 * the web editor adds node views on top of these same definitions.
 *
 * Shape: doc → lessonHeader, section+ ; section → activity* ; activity → lesson blocks.
 * Structured blocks (Pulse Check, ELD panel, support table) are atoms whose
 * content lives in attributes and is edited through forms.
 */

/** A JSON-valued attribute stored on the node and synced through Yjs as a whole. */
const jsonAttr = (fallback: unknown) => ({
  default: fallback,
  parseHTML: (el: { getAttribute(name: string): string | null }) =>
    JSON.parse(el.getAttribute('data-json') ?? 'null') ?? fallback,
  renderHTML: () => ({}),
});

const plainAttr = (fallback: unknown) => ({ default: fallback });

/** Shared markup for nodes: a div tagged with its type, plus attributes as data. */
function tagged(name: string, hasContent: boolean) {
  return {
    parseHTML: () => [{ tag: `div[data-type="${name}"]` }],
    renderHTML: ({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) =>
      hasContent
        ? (['div', { ...HTMLAttributes, 'data-type': name }, 0] as const)
        : (['div', { ...HTMLAttributes, 'data-type': name }] as const),
  };
}

const LessonDoc = Node.create({
  name: 'doc',
  topNode: true,
  content: 'lessonHeader section+',
});

const Text = Node.create({ name: 'text', group: 'inline' });

const Bold = Mark.create({
  name: 'bold',
  parseHTML: () => [{ tag: 'strong' }, { tag: 'b' }],
  renderHTML: () => ['strong', 0],
});

const Italic = Mark.create({
  name: 'italic',
  parseHTML: () => [{ tag: 'em' }, { tag: 'i' }],
  renderHTML: () => ['em', 0],
});

export const LessonHeaderNode = Node.create({
  name: 'lessonHeader',
  atom: true,
  selectable: false,
  draggable: false,
  addAttributes: () => ({
    title: plainAttr(''),
    lessonType: plainAttr('core-reading'),
    focusStandards: jsonAttr([]),
    supportingStandards: jsonAttr([]),
    eldStandards: jsonAttr([]),
    mediaLiteracyStandards: jsonAttr([]),
    objectives: jsonAttr([]),
    essentialQuestions: jsonAttr([]),
    connections: jsonAttr({
      knowledgeBuilding: '',
      enduringUnderstanding: '',
      futureLessons: '',
      performanceTask: '',
    }),
    vocabulary: jsonAttr([]),
    texts: jsonAttr([]),
  }),
  ...tagged('lessonHeader', false),
});

export const SectionNode = Node.create({
  name: 'section',
  content: 'activity*',
  defining: true,
  isolating: true,
  draggable: false,
  addAttributes: () => ({
    kind: plainAttr('launch'),
    title: plainAttr(''),
    purpose: plainAttr(''),
  }),
  ...tagged('section', true),
});

export const ActivityNode = Node.create({
  name: 'activity',
  content: 'lessonBlock*',
  defining: true,
  isolating: true,
  draggable: true,
  addAttributes: () => ({
    id: plainAttr(''),
    title: plainAttr(''),
    minutes: plainAttr(0),
    standards: jsonAttr([]),
    routine: plainAttr(null),
  }),
  ...tagged('activity', true),
});

/** Text blocks inside an Activity. */
function textBlock(name: string, attrs: Record<string, ReturnType<typeof plainAttr>> = {}) {
  return Node.create({
    name,
    group: 'lessonBlock',
    content: 'inline*',
    addAttributes: () => attrs,
    ...tagged(name, true),
  });
}

export const DirectionsNode = textBlock('directions');
export const ParagraphNode = textBlock('paragraph', { audience: plainAttr('shared') });
export const TeacherScriptNode = textBlock('teacherScript', { move: plainAttr('say') });
export const SampleResponseNode = textBlock('sampleResponse');
export const TeacherNoteNode = textBlock('teacherNote', { variant: plainAttr('note') });

/** Structured blocks: atoms edited through forms. */
function formBlock(name: string, attrs: Record<string, ReturnType<typeof jsonAttr>>) {
  return Node.create({
    name,
    group: 'lessonBlock',
    atom: true,
    draggable: true,
    addAttributes: () => attrs,
    ...tagged(name, false),
  });
}

export const PulseCheckNode = formBlock('pulseCheck', {
  standards: jsonAttr([]),
  stem: jsonAttr(''),
  choices: jsonAttr([]),
});
export const EldPanelNode = formBlock('eldPanel', {
  purpose: jsonAttr(''),
  sayAsk: jsonAttr(''),
  watchFor: jsonAttr(''),
});
export const SupportTableNode = formBlock('supportTable', { rows: jsonAttr([]) });

/** Every extension that defines the Lesson document, in schema order. */
export const lessonDocumentExtensions: AnyExtension[] = [
  LessonDoc,
  Text,
  Bold,
  Italic,
  LessonHeaderNode,
  SectionNode,
  ActivityNode,
  DirectionsNode,
  ParagraphNode,
  TeacherScriptNode,
  SampleResponseNode,
  TeacherNoteNode,
  PulseCheckNode,
  EldPanelNode,
  SupportTableNode,
];

let schema: Schema | undefined;

/** The ProseMirror schema of a Lesson document. */
export function lessonEditorSchema(): Schema {
  schema ??= getSchema(lessonDocumentExtensions);
  return schema;
}
