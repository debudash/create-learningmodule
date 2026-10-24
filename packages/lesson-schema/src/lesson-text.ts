import type { Block, Lesson } from './lesson.js';

const MOVE_LABELS = { say: 'Say', ask: 'Ask', teach: 'Teach' } as const;

function blockLines(block: Block): string[] {
  switch (block.type) {
    case 'directions':
      return [`Directions: ${block.text}`];
    case 'paragraph':
      return [block.audience === 'teacher' ? `(Teacher) ${block.text}` : block.text];
    case 'teacher-script':
      return [`${MOVE_LABELS[block.move]}: ${block.text}`];
    case 'sample-response':
      return [`Sample response: ${block.text}`];
    case 'teacher-note':
      return [`${block.variant === 'tip' ? 'Teacher Tip' : 'Teacher note'}: ${block.text}`];
    case 'text-reference':
      return [`Text: ${block.title}${block.pages ? ` (${block.pages})` : ''}`];
    case 'pulse-check':
      return [
        `Pulse Check (${block.standards.join(', ')}): ${block.stem}`,
        ...block.choices.map(
          (c, i) => `  ${String.fromCharCode(65 + i)}. ${c.text} (${c.correct ? 'Correct' : 'Incorrect'}: ${c.rationale})`,
        ),
      ];
    case 'eld-panel':
      return [`ELD purpose: ${block.purpose}`, `ELD say/ask: ${block.sayAsk}`, `ELD watch for: ${block.watchFor}`];
    case 'support-table':
      return block.rows.map((row) => `Support: ${row.situation} → ${row.tryThis}`);
  }
}

/**
 * The whole Lesson as readable lines (Teacher View), one fact per line, for
 * comparing Lesson Versions and for giving a Lesson to a reviewer.
 */
export function lessonToLines(lesson: Lesson): string[] {
  const { header } = lesson;
  return [
    `Title: ${lesson.title}`,
    `Focus Standards: ${header.focusStandards.join(', ')}`,
    `Supporting Standards: ${header.supportingStandards.join(', ')}`,
    `ELD Standards: ${header.eldStandards.join(', ')}`,
    ...header.objectives.map((o) => `Objective (${o.kind}): ${o.text}`),
    ...header.essentialQuestions.map((q) => `Essential question: ${q}`),
    ...header.vocabulary.map((v) => `Vocabulary: ${v.word}: ${v.definition}`),
    ...lesson.sections.flatMap((section) => [
      `## ${section.title}`,
      `Purpose: ${section.purpose}`,
      ...section.activities.flatMap((activity) => [
        `### ${activity.title} (${activity.minutes} min; ${activity.standards.join(', ') || 'no standards'}${activity.routine ? `; ${activity.routine}` : ''})`,
        ...activity.blocks.flatMap(blockLines),
      ]),
    ]),
  ];
}
