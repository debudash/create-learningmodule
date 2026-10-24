import { Database as DatabaseExtension } from '@hocuspocus/extension-database';
import { Server, type Connection } from '@hocuspocus/server';
import {
  findLessonStatus,
  findUser,
  listenForLessonChanges,
  loadDocumentState,
  saveLiveDocument,
  type Database,
  type LessonChangeListener,
  type User,
} from '@lcg/db';
import { isEditable } from '@lcg/domain';
import { verifySession } from '@lcg/session';
import * as Y from 'yjs';

const PREFIX = 'lesson:';

/** Collaboration document names are "lesson:<lesson id>". */
export const documentNameFor = (lessonId: string) => `${PREFIX}${lessonId}`;

function lessonIdOf(documentName: string): string {
  if (!documentName.startsWith(PREFIX)) throw new Error(`Unknown document ${documentName}`);
  return documentName.slice(PREFIX.length);
}

export interface CollabOptions {
  db: Database;
  sessionSecret: string;
  port?: number;
  /** Milliseconds of quiet before a document is stored. */
  debounce?: number;
}

export interface CollabServer {
  listen(): Promise<void>;
  destroy(): Promise<void>;
  /** Applies the stored document to every open copy of a Lesson (after a whole-Lesson replacement). */
  refreshDocument(lessonId: string): Promise<void>;
  /** Closes every live connection to a Lesson so editors reconnect under its current status. */
  reconnectEditors(lessonId: string): void;
}

interface ConnectionContext {
  user: User;
}

/**
 * The collaboration server (ADR 0004): authenticates each connection from the
 * session token, serves and stores Lesson documents, opens Approved Lessons
 * read-only, and remembers who edited each Lesson.
 */
export function createCollabServer({ db, sessionSecret, port = 1234, debounce = 2000 }: CollabOptions): CollabServer {
  const editorsSinceStore = new Map<string, Set<string>>();
  // Live connections per document, with the document each is attached to. Hocuspocus
  // can unload a document while a new connection is attaching to it (the connection
  // keeps that copy), so its own document map cannot be relied on to reach every
  // open copy; this registry can.
  const live = new Map<string, Map<string, Connection>>();

  const server = Server.configure({
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

    async connected({ documentName, socketId, connectionInstance }) {
      const connections = live.get(documentName) ?? new Map<string, Connection>();
      connections.set(socketId, connectionInstance);
      live.set(documentName, connections);
    },

    async onDisconnect({ documentName, socketId }) {
      live.get(documentName)?.delete(socketId);
    },

    async onChange({ documentName, context }) {
      // Changes applied by the server itself (a whole-Lesson replacement) have no editor.
      const user = (context as ConnectionContext | undefined)?.user;
      if (!user) return;
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
          const editors = editorsSinceStore.get(documentName);
          editorsSinceStore.delete(documentName);
          await saveLiveDocument(db, lessonId, state, [...(editors ?? [])]);
        },
      }),
    ],
  });

  const openCopies = (lessonId: string): Set<Y.Doc> => {
    const name = documentNameFor(lessonId);
    const copies = new Set<Y.Doc>([...(live.get(name)?.values() ?? [])].map((c) => c.document));
    const loaded = server.documents.get(name);
    if (loaded) copies.add(loaded);
    return copies;
  };

  return {
    listen: async () => {
      await server.listen();
    },
    destroy: () => server.destroy(),
    async refreshDocument(lessonId) {
      const copies = openCopies(lessonId);
      if (copies.size === 0) return;
      const state = await loadDocumentState(db, lessonId);
      if (state) for (const copy of copies) Y.applyUpdate(copy, state);
    },
    reconnectEditors(lessonId) {
      for (const connection of live.get(documentNameFor(lessonId))?.values() ?? []) connection.close();
    },
  };
}

/**
 * Follows Lesson changes made outside the collaboration server:
 * - a whole-Lesson replacement is applied to every open copy (LCG-7, see
 *   packages/db/src/documents.ts);
 * - LCG-8: read-only was decided only when a connection was authenticated, so
 *   editors who had a Lesson open when it was Approved could keep editing it. A
 *   status change now closes their connections; providers reconnect and are
 *   authenticated again against the new status (read-only once Approved,
 *   editable again after Reopen).
 */
export function followLessonChanges(collab: CollabServer, databaseUrl: string): Promise<LessonChangeListener> {
  return listenForLessonChanges(databaseUrl, (channel, lessonId) => {
    if (channel === 'document') void collab.refreshDocument(lessonId);
    else collab.reconnectEditors(lessonId);
  });
}
