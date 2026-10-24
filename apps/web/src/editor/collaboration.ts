'use client';

import { HocuspocusProvider } from '@hocuspocus/provider';
import { LESSON_FRAGMENT } from '@lcg/lesson-schema';
import { useEffect, useState } from 'react';
import { IndexeddbPersistence } from 'y-indexeddb';
import * as Y from 'yjs';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export interface Collaboration {
  provider: HocuspocusProvider;
  document: Y.Doc;
  /**
   * The document may be bound to an editor: the server has sent the stored document,
   * or (offline) this browser holds a copy with content. Binding an editor to an
   * empty document would write a blank Lesson into it.
   */
  ready: boolean;
  /** The server opened this Lesson read-only (for example, it is Approved). */
  readOnly: boolean;
  connection: ConnectionState;
  /** Local changes the server has not confirmed yet. */
  unsyncedChanges: number;
  failure?: string;
}

const COLLAB_URL = process.env.NEXT_PUBLIC_COLLAB_URL ?? 'ws://localhost:1234';

/**
 * Connects to the collaboration server for one Lesson while the component is
 * mounted. Changes are also kept in this browser (IndexedDB), so edits made while
 * offline survive a reload and are sent when the connection returns.
 */
export function useCollaboration(lessonId: string, token: string): Collaboration | undefined {
  const [state, setState] = useState<Collaboration>();

  useEffect(() => {
    const name = `lesson:${lessonId}`;
    const document = new Y.Doc();
    const local = new IndexeddbPersistence(name, document);
    const provider = new HocuspocusProvider({ url: COLLAB_URL, name, token, document });
    const update = (patch: Partial<Collaboration>) => setState((s) => s && { ...s, ...patch });

    setState({ provider, document, ready: false, readOnly: false, connection: 'connecting', unsyncedChanges: 0 });
    void local.whenSynced.then(() => {
      if (document.getXmlFragment(LESSON_FRAGMENT).length > 0) update({ ready: true });
    });
    provider.on('synced', () => update({ ready: true }));
    provider.on('authenticated', () => update({ readOnly: provider.authorizedScope === 'readonly' }));
    provider.on('authenticationFailed', ({ reason }: { reason: string }) => update({ failure: reason }));
    provider.on('status', ({ status }: { status: ConnectionState }) => update({ connection: status }));
    provider.on('unsyncedChanges', (count: number) => update({ unsyncedChanges: count }));

    return () => {
      provider.destroy();
      void local.destroy();
      document.destroy();
    };
  }, [lessonId, token]);

  return state;
}

const CURSOR_COLORS = ['#2f6f73', '#6b3fa0', '#b45309', '#1f6f8b', '#be185d', '#3f6b2a'];

/** A stable colour per person, so everyone sees the same colour for the same colleague. */
export function colorFor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CURSOR_COLORS[hash % CURSOR_COLORS.length]!;
}
