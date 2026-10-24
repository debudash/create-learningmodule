import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from 'y-prosemirror';
import * as Y from 'yjs';
import { documentToLesson, lessonToDocument, type DocumentToLessonResult } from './convert.js';
import { lessonEditorSchema } from './editor-schema.js';
import type { Lesson } from './lesson.js';

/** The Yjs XML fragment the editor binds to (Tiptap Collaboration's default field). */
export const LESSON_FRAGMENT = 'default';

/** Lesson JSON → Yjs document state, ready to store or send to the collaboration server. */
export function lessonToYState(lesson: Lesson): Uint8Array {
  const ydoc = prosemirrorJSONToYDoc(lessonEditorSchema(), lessonToDocument(lesson), LESSON_FRAGMENT);
  return Y.encodeStateAsUpdate(ydoc);
}

/** Stored Yjs document state → Lesson JSON. */
export function yStateToLesson(state: Uint8Array): DocumentToLessonResult {
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, state);
  return documentToLesson(yDocToProsemirrorJSON(ydoc, LESSON_FRAGMENT));
}
