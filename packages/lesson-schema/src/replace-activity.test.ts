import { getSchema } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import { documentToLesson, lessonToDocument } from './convert.js';
import { lessonDocumentExtensions } from './editor-schema.js';
import type { Activity, Lesson } from './lesson.js';
import { replaceActivity } from './replace-activity.js';
import { sampleLesson } from './testing.js';

const schema = getSchema(lessonDocumentExtensions);
const stateOf = (lesson: Lesson) => EditorState.create({ schema, doc: schema.nodeFromJSON(lessonToDocument(lesson)) });
const partBOf = (lesson: Lesson): Activity => lesson.sections.flatMap((s) => s.activities).find((a) => a.id === 'lia-part-b')!;

const before = partBOf(sampleLesson());
const after: Activity = { ...before, blocks: [...before.blocks, { type: 'sample-response', text: 'A modern city.' }] };

describe('replaceActivity', () => {
  it('replaces the Activity when it is as the suggestion saw it', () => {
    const result = replaceActivity(stateOf(sampleLesson()), before, after);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const lesson = documentToLesson(result.tr.doc.toJSON());
    expect(lesson.ok && partBOf(lesson.lesson)).toEqual(after);
  });

  // LCG-25, found by the Phase 6 spec review: a colleague's edit landing after the stale check was wiped.
  it('LCG-25: refuses when the Activity changed since the suggestion was made', () => {
    const edited = sampleLesson();
    partBOf(edited).title = 'Renamed by a colleague';
    expect(replaceActivity(stateOf(edited), before, after)).toEqual({ ok: false, reason: 'changed' });
  });

  it('refuses when the Activity is gone', () => {
    const removed = sampleLesson();
    for (const section of removed.sections) section.activities = section.activities.filter((a) => a.id !== 'lia-part-b');
    expect(replaceActivity(stateOf(removed), before, after)).toEqual({ ok: false, reason: 'missing' });
  });
});
