import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { ySyncPluginKey } from 'y-prosemirror';

/** Transactions carrying this meta key may change the Lesson's Section structure. */
export const STRUCTURE_CHANGE_META = 'lessonStructureChange';

/** The Lesson's fixed structure: the header, then each Section's kind, in order. */
export function structureSignature(doc: ProseMirrorNode): string {
  const parts: string[] = [];
  doc.forEach((child) => parts.push(child.type.name === 'section' ? `section:${child.attrs.kind}` : child.type.name));
  return parts.join('|');
}

function isRemoteOrAllowed(tr: Transaction): boolean {
  const sync = tr.getMeta(ySyncPluginKey) as { isChangeOrigin?: boolean } | undefined;
  return Boolean(sync?.isChangeOrigin) || tr.getMeta(STRUCTURE_CHANGE_META) === true;
}

/**
 * Keeps every Lesson's house structure: local edits may change anything inside
 * the Sections but cannot delete, add or reorder the header or the Sections.
 * Changes synced from collaborators, and transactions marked with
 * STRUCTURE_CHANGE_META (whole-Lesson replacement), pass through.
 */
export const LessonStructureGuard = Extension.create({
  name: 'lessonStructureGuard',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('lessonStructureGuard'),
        filterTransaction: (tr, state) =>
          !tr.docChanged || isRemoteOrAllowed(tr) || structureSignature(tr.doc) === structureSignature(state.doc),
      }),
    ];
  },
});
