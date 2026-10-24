import { describe, expect, it } from 'vitest';
import { getStandard } from '@lcg/standards';
import { sectionMinutes, type Block } from '@lcg/lesson-schema';
import { sampleLesson } from '@lcg/lesson-schema/testing';
import {
  SAMPLE_RESPONSE_COLOR,
  TEACHER_SCRIPT_COLOR,
  toNewselaLesson,
  type NewselaNode,
} from './index.js';

const lesson = sampleLesson();
const { lesson: converted, unmapped } = toNewselaLesson(lesson, { lessonNumber: 3 });

/** Every text node under these nodes. */
function textNodes(nodes: NewselaNode[]): NewselaNode[] {
  return nodes.flatMap((n) => (n.type === 'text' ? [n] : textNodes(n.content ?? [])));
}

/** The plain text under these nodes, run together. */
const plainText = (nodes: NewselaNode[]) =>
  textNodes(nodes)
    .map((n) => n.text)
    .join('');

const colored = (nodes: NewselaNode[], hex: string) =>
  textNodes(nodes)
    .filter((n) => n.marks?.some((m) => m.type === 'textColor' && m.attrs.color === hex))
    .map((n) => n.text)
    .join('');

const blocksOf = <T extends Block['type']>(type: T) =>
  lesson.sections
    .flatMap((s) => s.activities.flatMap((a) => a.blocks))
    .filter((b): b is Extract<Block, { type: T }> => b.type === type);

/** Lesson JSON inline text without its Markdown markers. */
const unmarked = (s: string) => s.replace(/\*+/g, '');

const teacherBodies = converted.sections.teacher.flatMap((s) => s.body.content);
const studentBodies = converted.sections.student.flatMap((s) => s.body.content);

describe('toNewselaLesson on the sample Lesson', () => {
  it('maps the header fields', () => {
    expect(converted.title).toBe('Lesson 3: Rick Riordan as a Myth Adapter');
    expect(converted.type).toBe('Spark');
    expect(converted.total_time_in_minutes).toEqual([50, 50]);
    expect(converted.objectives.teacher.map((o) => o.title)).toEqual([
      'Content',
      'Language',
      'Foundational Skills',
    ]);
    expect(plainText(converted.objectives.teacher[0]!.body.content)).toMatch(
      /^Students will determine/,
    );
    expect(plainText(converted.objectives.student[0]!.body.content)).toMatch(
      /^Determine what an author/,
    );
    expect(converted.connections.map((c) => c.title)).toEqual([
      'Knowledge-Building',
      'Enduring Understanding',
      'Future Lessons',
      'Unit Performance Task',
    ]);
    expect(plainText(converted.essential_questions.content)).toContain(
      'How do myths reflect cultural values?',
    );
    expect(converted.vocabulary_lists[0]).toMatchObject({
      title: 'Vocabulary Addressed in Lesson',
    });
    expect(converted.vocabulary_lists[0]!.vocabulary.map((v) => v.word)).toContain('transform');
  });

  it('carries the official description of each standard', () => {
    const [focus, supporting, eld] = converted.standard_lists;
    expect(focus!.standards.map((s) => s.code)).toEqual(['L.6.4.b', 'RI.6.4']);
    expect(supporting!.standards.map((s) => s.code)).toEqual(['SL.6.1']);
    expect(eld!.standards.map((s) => s.code)).toEqual(['ELD.PI.6.7', 'ELD.PI.6.6', 'ELD.PII.6.4']);
    for (const list of converted.standard_lists) {
      for (const s of list.standards) expect(s.description).toBe(getStandard(s.code)!.text);
    }
  });

  it('keeps every Section in order with its minutes', () => {
    expect(
      converted.sections.teacher.map((s) => [s.title, s.sequence, s.estimated_time_in_minutes]),
    ).toEqual(
      lesson.sections.map((s, i) => [s.title, i + 1, [sectionMinutes(s), sectionMinutes(s)]]),
    );
    expect(converted.sections.student.map((s) => s.title)).toEqual(
      lesson.sections.map((s) => s.title),
    );
  });

  it('writes teacher scripts in teal after a bold move label, and sample responses in purple', () => {
    const teal = colored(teacherBodies, TEACHER_SCRIPT_COLOR);
    for (const script of blocksOf('teacher-script')) expect(teal).toContain(unmarked(script.text));
    const purple = colored(teacherBodies, SAMPLE_RESPONSE_COLOR);
    for (const response of blocksOf('sample-response')) expect(purple).toContain(response.text);

    const bold = textNodes(teacherBodies).filter((n) => n.marks?.some((m) => m.type === 'strong'));
    expect(bold.map((n) => n.text)).toEqual(
      expect.arrayContaining(['Say:', 'Ask:', 'Teach:', 'Directions:']),
    );
    // *adapter* in a teacher script keeps its italic, alongside the teal colour.
    const adapter = textNodes(teacherBodies).find((n) => n.text === 'adapter');
    expect(adapter?.marks?.map((m) => m.type)).toEqual(['em', 'textColor']);
  });

  it('maps the support blocks to the collapsibles and tables Newsela uses', () => {
    const collapsibles = teacherBodies.filter((n) => n.type === 'collapsible');
    expect(collapsibles.map((n) => n.attrs?.label)).toEqual([
      'Integrated ELD Instructions',
      'Additional Student Support',
    ]);
    const callouts = collapsibles[0]!.content!.map((n) => [n.type, n.attrs?.variant]);
    expect(callouts).toEqual([
      ['callout', 'purpose'],
      ['callout', 'say'],
      ['callout', 'watch'],
    ]);
    const pulse = teacherBodies.find(
      (n) => n.type === 'table' && plainText([n]).startsWith('Pulse Check'),
    )!;
    expect(textNodes([pulse])[0]!.text).toBe('Pulse Check (L.6.4.b)');
    expect(plainText([pulse])).toContain('Correct: Trans- plus form');
    expect(plainText([pulse])).toContain('Incorrect: Copying keeps');
  });

  it('leaves all teacher-only material out of the student sections', () => {
    const student = plainText(studentBodies);
    const teacherOnly = [
      ...blocksOf('teacher-script').map((b) => b.text),
      ...blocksOf('sample-response').map((b) => b.text),
      ...blocksOf('teacher-note').map((b) => b.text),
      ...blocksOf('eld-panel').flatMap((b) => [b.purpose, b.sayAsk, b.watchFor]),
      ...blocksOf('support-table').flatMap((b) => b.rows.flatMap((r) => [r.situation, r.tryThis])),
      ...blocksOf('pulse-check').flatMap((b) => b.choices.map((c) => c.rationale)),
    ];
    for (const t of teacherOnly) expect(student).not.toContain(unmarked(t));
    expect(colored(studentBodies, SAMPLE_RESPONSE_COLOR)).toBe('');
    expect(colored(studentBodies, TEACHER_SCRIPT_COLOR)).toBe('');
    expect(studentBodies.some((n) => n.type === 'collapsible')).toBe(false);
    for (const s of converted.sections.student) {
      expect(s.purpose.content).toEqual([]);
      expect(s.estimated_time_in_minutes).toEqual([0, 0]);
    }
    // Students still get the directions and the Pulse Check question.
    expect(student).toContain(unmarked(blocksOf('directions')[0]!.text));
    expect(student).toContain('Which meaning of transform');
  });

  it('lists what it does not map, including the cards', () => {
    expect(unmapped.map((u) => u.split(':')[0])).toEqual(
      expect.arrayContaining(['anchor_text_cards', 'resource_cards', 'Activity standards']),
    );
  });
});
