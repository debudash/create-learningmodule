import { describe, expect, it } from 'vitest';
import { documentToLesson, lessonToDocument } from './convert.js';
import { lessonEditorSchema } from './editor-schema.js';
import { LESSON_TYPES } from './lesson-type.js';
import type { Lesson } from './lesson.js';
import { SECTION_PLANS } from './section-plan.js';
import { sampleLesson } from './testing.js';

/** The sample's Activities rearranged into each Lesson Type's Sections. */
function lessonOfType(type: (typeof LESSON_TYPES)[number]): Lesson {
  const sample = sampleLesson();
  const activities = sample.sections.flatMap((s) => s.activities);
  return {
    ...sample,
    lessonType: type,
    sections: SECTION_PLANS[type].map((plan, i) => ({
      kind: plan.kind,
      title: plan.kind,
      purpose: `Purpose ${i}`,
      activities: [activities[i % activities.length]!],
    })),
  };
}

describe('Lesson JSON to editor document and back', () => {
  it('round-trips the sample Lesson without loss', () => {
    const lesson = sampleLesson();
    expect(documentToLesson(lessonToDocument(lesson))).toEqual({ ok: true, lesson });
  });

  it('round-trips through a real ProseMirror document, keeping every attribute', () => {
    const lesson = sampleLesson();
    const node = lessonEditorSchema().nodeFromJSON(lessonToDocument(lesson));
    node.check();
    expect(documentToLesson(node.toJSON())).toEqual({ ok: true, lesson });
  });

  it.each(LESSON_TYPES)('round-trips a %s Lesson', (type) => {
    const lesson = lessonOfType(type);
    const node = lessonEditorSchema().nodeFromJSON(lessonToDocument(lesson));
    expect(documentToLesson(node.toJSON())).toEqual({ ok: true, lesson });
  });

  it('rejects a document that is not a valid Lesson, saying where', () => {
    const doc = lessonToDocument(sampleLesson());
    doc.content![1]!.attrs!.kind = 'recess';
    const result = documentToLesson(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(' ')).toMatch(/sections\.0\.kind/);
  });

  it('gives an Activity without an id a position-based id', () => {
    const doc = lessonToDocument(sampleLesson());
    doc.content![1]!.content![0]!.attrs!.id = '';
    const result = documentToLesson(doc);
    expect(result.ok && result.lesson.sections[0]!.activities[0]!.id).toBe('s1-a1');
  });

  it('refuses a document with no Sections', () => {
    const schema = lessonEditorSchema();
    expect(() => schema.nodeFromJSON({ type: 'doc', content: [{ type: 'lessonHeader' }] }).check()).toThrow();
  });
});

describe('Lesson schema rules', () => {
  // LCG-4 regression. Found by: Phase 2 spec review (a Pulse Check could have no or several correct choices).
  it('LCG-4: requires exactly one correct choice in a Pulse Check', () => {
    const withChoices = (correct: boolean[]) => {
      const lesson = sampleLesson();
      const pulse = lesson.sections[1]!.activities[0]!.blocks.find((b) => b.type === 'pulse-check')!;
      if (pulse.type !== 'pulse-check') throw new Error('fixture has no Pulse Check');
      pulse.choices = correct.map((c, i) => ({ text: `choice ${i}`, correct: c, rationale: 'because' }));
      return documentToLesson(lessonToDocument(lesson));
    };
    expect(withChoices([true, false]).ok).toBe(true);
    expect(withChoices([false, false]).ok).toBe(false);
    expect(withChoices([true, true]).ok).toBe(false);
  });
});
