'use client';

import { HocuspocusProvider } from '@hocuspocus/provider';
import { useEffect, useState } from 'react';
import * as Y from 'yjs';

export interface Collaboration {
  provider: HocuspocusProvider;
  document: Y.Doc;
  /** The server has sent the stored document; only now may an editor bind to it. */
  synced: boolean;
  /** The server opened this Lesson read-only (for example, it is Approved). */
  readOnly: boolean;
  failure?: string;
}

const COLLAB_URL = process.env.NEXT_PUBLIC_COLLAB_URL ?? 'ws://localhost:1234';

/** Connects to the collaboration server for one Lesson for as long as the component is mounted. */
export function useCollaboration(lessonId: string, token: string): Collaboration | undefined {
  const [state, setState] = useState<Collaboration>();

  useEffect(() => {
    const document = new Y.Doc();
    const provider = new HocuspocusProvider({ url: COLLAB_URL, name: `lesson:${lessonId}`, token, document });
    setState({ provider, document, synced: false, readOnly: false });
    provider.on('authenticated', () =>
      setState((s) => s && { ...s, readOnly: provider.authorizedScope === 'readonly' }),
    );
    provider.on('synced', () => setState((s) => s && { ...s, synced: true }));
    provider.on('authenticationFailed', ({ reason }: { reason: string }) =>
      setState((s) => s && { ...s, failure: reason }),
    );
    return () => {
      provider.destroy();
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
