import type { LessonType } from '@lcg/lesson-schema';

/** Which standards list on an Outline row a reference came from. */
export type StandardsField =
  | 'focusStandards'
  | 'supportingStandards'
  | 'mediaLiteracyStandards'
  | 'eldStandards';

/** A standard code as written in the Outline, with its canonical form once known. */
export interface StandardRef {
  /** Canonical code, or the raw text when it could not be normalised. */
  code: string;
  /** Exactly what the Outline cell said for this entry. */
  raw: string;
}

export interface EldStandardRef extends StandardRef {
  /** The Outline's own short description, e.g. "Analyze author purpose and message". */
  description: string;
}

export interface VocabularyWord {
  word: string;
  /** Anchor-text page the word appears on, when the Outline gives one. */
  page?: number;
}

export interface PageRange {
  from: number;
  to: number;
}

export type OutlineIssueKind =
  | 'malformed-standard'
  | 'unknown-standard'
  | 'eld-description-mismatch'
  | 'metadata-conflict'
  | 'filename-mismatch'
  | 'day-total-mismatch'
  | 'arc-mismatch'
  | 'unknown-lesson-type'
  | 'missing-column';

export type OutlineIssueSeverity = 'blocking' | 'warning';

/** A problem found in a Unit Outline at import (see GLOSSARY: Outline Issue). */
export interface OutlineIssue {
  /** Stable across re-parses of the same Outline, e.g. "L4.focusStandards.6.2". */
  id: string;
  severity: OutlineIssueSeverity;
  kind: OutlineIssueKind;
  message: string;
  /** The Lesson it concerns, by key ("L4", "F2"); absent for Unit-level issues. */
  lessonKey?: string;
  field?: StandardsField;
  /** The Outline text the issue is about. */
  raw?: string;
  /** For standards issues: the entry's code as parsed (canonical, or the raw text if malformed). */
  code?: string;
  /** A proposed replacement value (a canonical standard code for standards issues). */
  suggestion?: string;
}

export interface AnchorText {
  title: string;
  author: string;
  isbn?: string;
}

export interface OutlineUnit {
  title: string;
  grade: number;
  unitNumber: number;
  anchorText: AnchorText;
  /** Name of the Performance Task, when the Outline states one. */
  performanceTask?: string;
}

export interface OutlineArc {
  key: string;
  name: string;
  /** 1-based order within the Unit. */
  position: number;
  description: string;
  /** What the Arc's Lessons must build toward the Performance Task, if stated. */
  performanceTaskSkills?: string;
  /** Description given on the Arc's Flex Day header row, if any. */
  flexDescription?: string;
}

export type OutlineLessonKind = 'lesson' | 'flex-day';

/** One Outline row that becomes a Lesson. */
export interface OutlineLesson {
  /** "L1".."L41" for Lessons, "F1".."F6" for Flex Days, in Outline order. */
  key: string;
  kind: OutlineLessonKind;
  /** 1-based day of instruction within the Unit (Lessons and Flex Days together). */
  position: number;
  /** The Outline's lesson number; Flex Days have none. */
  lessonNumber?: number;
  arcKey: string;
  lessonType: LessonType;
  /** The Outline's own type label, e.g. "Spark 2" or "Core Writing (Double Lesson)". */
  outlineType: string;
  isDoubleLesson: boolean;
  filename?: string;
  /** First line of the description when it reads as a heading (e.g. "Rick Riordan as a Myth Adapter"). */
  heading?: string;
  textDependentQuestion?: string;
  learningGoals: string[];
  description: string;
  textSet: string;
  homework: string;
  /** Anchor-text pages the Lesson focuses on, when the description names them. */
  focusPages?: PageRange;
  focusStandards: StandardRef[];
  supportingStandards: StandardRef[];
  mediaLiteracyStandards: StandardRef[];
  eldStandards: EldStandardRef[];
  performanceTaskSkill: string;
  foundationalSkills: string;
  vocabulary: VocabularyWord[];
  /** Guidance left for the Lesson writer inside list cells (see GLOSSARY: Designer Note). */
  designerNotes: string[];
  /** Every cell of the row, keyed by the Outline's column header, exactly as written. */
  rawCells: Record<string, string>;
}

/** What the import preview shows: everything found, plus the issues to resolve. */
export interface ImportProposal {
  unit: OutlineUnit;
  arcs: OutlineArc[];
  lessons: OutlineLesson[];
  issues: OutlineIssue[];
  /** Day total stated by the Outline's summary row, if present. */
  statedDayTotal?: number;
}

export type Resolution =
  /** Use the issue's suggestion. */
  | { issueId: string; action: 'accept-suggestion' }
  /** Replace the problem text with a value the Editor typed. */
  | { issueId: string; action: 'replace'; value: string }
  /** Drop the problem entry. */
  | { issueId: string; action: 'remove' }
  /** Keep the entry as written. Warnings only. */
  | { issueId: string; action: 'accept' };

export interface ResolvedIssue extends OutlineIssue {
  resolution: Resolution['action'] | 'accepted-by-default';
  /** The value used after resolution, when one applies. */
  resolvedValue?: string;
}

/** An Outline ready to become a Unit: no Blocking issues remain. */
export interface ConfirmedImport {
  unit: OutlineUnit;
  arcs: OutlineArc[];
  lessons: OutlineLesson[];
  /** Every issue found and how it was resolved, kept for the audit trail. */
  issues: ResolvedIssue[];
}

export type ConfirmResult =
  | { ok: true; confirmed: ConfirmedImport }
  | { ok: false; unresolved: OutlineIssue[]; errors: string[] };
