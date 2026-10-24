import { prosemirrorJSONToYXmlFragment, yDocToProsemirrorJSON } from 'y-prosemirror';
import * as Y from 'yjs';
import { documentToLesson, lessonToDocument, type DocumentToLessonResult } from './convert.js';
import { lessonEditorSchema } from './editor-schema.js';
import type { Lesson } from './lesson.js';

/** The Yjs XML fragment the editor binds to (Tiptap Collaboration's default field). */
export const LESSON_FRAGMENT = 'default';

/** Lesson JSON → Yjs document state for a Lesson that has no document yet. */
export function lessonToYState(lesson: Lesson): Uint8Array {
  return replaceLessonInYState(undefined, lesson);
}

/**
 * Replaces the whole Lesson inside existing Yjs state. The replacement is an
 * ordinary Yjs change (old content deleted, new content inserted), so it merges
 * cleanly with every copy of the document that editors and the collaboration
 * server already hold, instead of competing with them.
 */
export function replaceLessonInYState(state: Uint8Array | undefined, lesson: Lesson): Uint8Array {
  const ydoc = new Y.Doc();
  if (state) Y.applyUpdate(ydoc, state);
  const fragment = ydoc.getXmlFragment(LESSON_FRAGMENT);
  ydoc.transact(() => {
    fragment.delete(0, fragment.length);
    prosemirrorJSONToYXmlFragment(lessonEditorSchema(), lessonToDocument(lesson), fragment);
  });
  return Y.encodeStateAsUpdate(ydoc);
}

/** Combines two Yjs states of the same document, keeping every change in either. */
export function mergeYStates(a: Uint8Array, b: Uint8Array): Uint8Array {
  return Y.mergeUpdates([a, b]);
}

/** Stored Yjs document state → Lesson JSON. */
export function yStateToLesson(state: Uint8Array): DocumentToLessonResult {
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, state);
  return documentToLesson(yDocToProsemirrorJSON(ydoc, LESSON_FRAGMENT));
}
