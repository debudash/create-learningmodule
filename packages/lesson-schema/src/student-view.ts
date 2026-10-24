import { TEACHER_ONLY_BLOCKS, type Block, type Lesson, type SectionKind } from './lesson.js';
import type { LessonType } from './lesson-type.js';

/** A block as students see it: no teacher material, no answers. */
export type StudentBlock =
  | { type: 'directions'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'pulse-check'; stem: string; choices: string[] }
  | { type: 'text-reference'; title: string; pages?: string };

export interface StudentLesson {
  title: string;
  lessonType: LessonType;
  objectives: string[];
  essentialQuestions: string[];
  vocabulary: { word: string; definition: string }[];
  texts: { title: string; author?: string; pages?: string }[];
  sections: {
    kind: SectionKind;
    title: string;
    activities: { id: string; title: string; routine?: string; blocks: StudentBlock[] }[];
  }[];
}

/**
 * The Student View: the Teacher View with all teacher-only material removed
 * (scripts, sample responses, notes, ELD panels, support tables, answer keys,
 * Section purposes and timings).
 */
export function studentView(lesson: Lesson): StudentLesson {
  return {
    title: lesson.title,
    lessonType: lesson.lessonType,
    objectives: lesson.header.objectives.map((o) => studentWording(o.text)),
    essentialQuestions: lesson.header.essentialQuestions,
    vocabulary: lesson.header.vocabulary.map(({ word, definition }) => ({ word, definition })),
    texts: lesson.header.texts,
    sections: lesson.sections.map((section) => ({
      kind: section.kind,
      title: section.title,
      activities: section.activities.map((activity) => ({
        id: activity.id,
        title: activity.title,
        ...(activity.routine ? { routine: activity.routine } : {}),
        blocks: activity.blocks.flatMap(toStudentBlock),
      })),
    })),
  };
}

function toStudentBlock(block: Block): StudentBlock[] {
  if (TEACHER_ONLY_BLOCKS.has(block.type)) return [];
  switch (block.type) {
    case 'directions':
      return [{ type: 'directions', text: block.text }];
    case 'paragraph':
      return block.audience === 'shared' ? [{ type: 'paragraph', text: block.text }] : [];
    case 'pulse-check':
      return [{ type: 'pulse-check', stem: block.stem, choices: block.choices.map((c) => c.text) }];
    case 'text-reference':
      return [block];
    default:
      return [];
  }
}

/** "Students will determine ..." → "Determine ...". */
function studentWording(text: string): string {
  const stripped = text.replace(/^students will\s+/i, '');
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}
