import { Database as DatabaseExtension } from '@hocuspocus/extension-database';
import { Server, type Hocuspocus } from '@hocuspocus/server';
import {
  findLessonStatus,
  findUser,
  loadDocumentState,
  recordEditors,
  storeDocumentState,
  type Database,
  type User,
} from '@lcg/db';
import { isEditable } from '@lcg/domain';
import { yStateToLesson } from '@lcg/lesson-schema';
import { verifySession } from '@lcg/session';

/** Collaboration document names are "lesson:<lesson id>". */
export const documentNameFor = (lessonId: string) => `lesson:${lessonId}`;

function lessonIdOf(documentName: string): string {
  if (!documentName.startsWith('lesson:')) throw new Error(`Unknown document ${documentName}`);
  return documentName.slice('lesson:'.length);
}

export interface CollabOptions {
  db: Database;
  sessionSecret: string;
  port?: number;
  /** Milliseconds of quiet before a document is stored. */
  debounce?: number;
}

interface ConnectionContext {
  user: User;
}

/**
 * The collaboration server (ADR 0004): authenticates each connection from the
 * session token, serves and stores Lesson documents, opens Approved Lessons
 * read-only, and remembers who edited each Lesson.
 */
export function createCollabServer({ db, sessionSecret, port = 1234, debounce = 2000 }: CollabOptions): Hocuspocus {
  const editorsSinceStore = new Map<string, Set<string>>();

  return Server.configure({
    port,
    quiet: true,
    debounce,
    maxDebounce: debounce * 5,

    async onAuthenticate({ token, documentName, connection }) {
      const userId = verifySession(token, sessionSecret);
      const user = userId ? await findUser(db, userId) : undefined;
      if (!user) throw new Error('Not signed in');

      const status = await findLessonStatus(db, lessonIdOf(documentName));
      if (!status) throw new Error('No such Lesson');
      if (!isEditable(status)) connection.readOnly = true;
      return { user } satisfies ConnectionContext;
    },

    async onChange({ documentName, context }) {
      const { user } = context as ConnectionContext;
      const editors = editorsSinceStore.get(documentName) ?? new Set<string>();
      editors.add(user.id);
      editorsSinceStore.set(documentName, editors);
    },

    extensions: [
      new DatabaseExtension({
        fetch: async ({ documentName }) => (await loadDocumentState(db, lessonIdOf(documentName))) ?? null,
        store: async ({ documentName, state }) => {
          const lessonId = lessonIdOf(documentName);
          // A Lesson approved while editors were connected keeps its approved content.
          const status = await findLessonStatus(db, lessonId);
          if (!status || !isEditable(status)) return;
          // LCG-5: only a valid Lesson is stored; a broken document keeps the last good one.
          if (!yStateToLesson(state).ok) return;
          await storeDocumentState(db, lessonId, state);
          const editors = editorsSinceStore.get(documentName);
          editorsSinceStore.delete(documentName);
          await recordEditors(db, lessonId, [...(editors ?? [])]);
        },
      }),
    ],
  });
}
