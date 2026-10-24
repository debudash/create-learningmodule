import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';
import {
  LESSON_FRAGMENT,
  lessonToYState,
  mergeYStates,
  replaceLessonInYState,
  yStateToLesson,
} from './ydoc.js';
import { sampleLesson } from './testing.js';

describe('Lesson JSON and Yjs state', () => {
  it('round-trips the sample Lesson through Yjs state', () => {
    const lesson = sampleLesson();
    expect(yStateToLesson(lessonToYState(lesson))).toEqual({ ok: true, lesson });
  });

  it('replaces a Lesson so that a copy holding the old content converges on the new one', () => {
    const original = lessonToYState(sampleLesson());
    const replaced = replaceLessonInYState(original, { ...sampleLesson(), title: 'Replaced' });

    const editorCopy = new Y.Doc();
    Y.applyUpdate(editorCopy, original);
    Y.applyUpdate(editorCopy, replaced);
    const result = yStateToLesson(Y.encodeStateAsUpdate(editorCopy));
    expect(result).toEqual({ ok: true, lesson: { ...sampleLesson(), title: 'Replaced' } });
    expect(yStateToLesson(mergeYStates(original, replaced))).toEqual(result);
  });

  it('reflects an edit merged from another Yjs document', () => {
    const lesson = sampleLesson();
    const mine = new Y.Doc();
    Y.applyUpdate(mine, lessonToYState(lesson));

    const theirs = new Y.Doc();
    Y.applyUpdate(theirs, Y.encodeStateAsUpdate(mine));
    const header = theirs.getXmlFragment(LESSON_FRAGMENT).get(0) as Y.XmlElement;
    header.setAttribute('title', 'Riordan Remakes the Myths');
    Y.applyUpdate(mine, Y.encodeStateAsUpdate(theirs));

    const result = yStateToLesson(Y.encodeStateAsUpdate(mine));
    expect(result.ok && result.lesson.title).toBe('Riordan Remakes the Myths');
  });
});
