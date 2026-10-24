/**
 * The shape of Newsela's published lesson object, as observed in the public review site
 * (docs/source/example-lessons/STRUCTURE.md). This is not an official contract: it is inferred
 * from the dehydrated page data, and covers only the parts this converter populates.
 */

/** A mark on a text node. Newsela's data uses strong, em and textColor. */
export type NewselaMark =
  | { type: 'strong' }
  | { type: 'em' }
  | { type: 'textColor'; attrs: { color: string } };

/** A ProseMirror/Tiptap node with the node names Newsela's data uses. */
export interface NewselaNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: NewselaNode[];
  text?: string;
  marks?: NewselaMark[];
}

/** A rich-text field: a ProseMirror document. */
export interface NewselaDoc {
  type: 'doc';
  content: NewselaNode[];
}

export interface NewselaStandardList {
  title:
    | 'California CCSS: Focus Standards'
    | 'California CCSS: Supporting Standards'
    | 'ELD Standards';
  standards: { code: string; description: string }[];
}

export interface NewselaObjective {
  title: 'Content' | 'Language' | 'Foundational Skills';
  body: NewselaDoc;
  audience: 'teacher' | 'student';
}

export interface NewselaSection {
  title: string;
  /** Teacher sections only; student sections carry an empty document. */
  purpose: NewselaDoc;
  audience: 'teacher' | 'student';
  /** 1-based order within the lesson. */
  sequence: number;
  /** A [min, max] pair; student sections carry [0, 0]. */
  estimated_time_in_minutes: [number, number];
  body: NewselaDoc;
}

export interface NewselaLesson {
  /** "Lesson N: Title". */
  title: string;
  /** Spark, Reading, Writing, Academic Discussion, Flex Day (and others we do not generate). */
  type: string;
  subject: 'ELA';
  total_time_in_minutes: [number, number];
  standard_lists: NewselaStandardList[];
  objectives: { teacher: NewselaObjective[]; student: NewselaObjective[] };
  essential_questions: NewselaDoc;
  connections: { title: string; body: NewselaDoc }[];
  /** The routine names used, as a bullet list. */
  routines: NewselaDoc;
  vocabulary_lists: { title: string; vocabulary: { word: string; definition: string }[] }[];
  /** Empty in every published lesson checked. */
  differentiators: never[];
  sections: { teacher: NewselaSection[]; student: NewselaSection[] };
}
