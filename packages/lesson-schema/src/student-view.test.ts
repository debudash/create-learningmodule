import { describe, expect, it } from 'vitest';
import { studentView } from './student-view.js';
import { sampleLesson } from './testing.js';

describe('studentView', () => {
  const lesson = sampleLesson();
  const view = studentView(lesson);
  const visible = JSON.stringify(view);

  it('removes every teacher-only block', () => {
    for (const activity of lesson.sections.flatMap((s) => s.activities)) {
      for (const block of activity.blocks) {
        if (
          block.type === 'teacher-script' ||
          block.type === 'sample-response' ||
          block.type === 'teacher-note'
        ) {
          expect(visible).not.toContain(block.text);
        }
        if (block.type === 'eld-panel') expect(visible).not.toContain(block.sayAsk);
        if (block.type === 'support-table') expect(visible).not.toContain(block.rows[0]!.tryThis);
      }
    }
  });

  it('keeps directions, shared paragraphs and Pulse Check questions without answers', () => {
    expect(visible).toContain('Read the interview excerpt.');
    expect(visible).toContain('Sentence frame');
    const pulse = view.sections[1]!.activities[0]!.blocks.find((b) => b.type === 'pulse-check');
    expect(pulse).toMatchObject({
      choices: [
        'to copy a story exactly',
        'to change a story into a new form',
        'to translate a story into Greek',
        'to shorten a story',
      ],
    });
    expect(visible).not.toContain('rationale');
    expect(visible).not.toContain('correct');
  });

  it('drops Section purposes and timings', () => {
    expect(visible).not.toContain(lesson.sections[0]!.purpose);
    expect(visible).not.toContain('minutes');
  });

  it('words objectives for students', () => {
    expect(view.objectives[0]).toBe(
      'Determine what an author believes about myths by analyzing word choice in an interview excerpt.',
    );
  });
});
