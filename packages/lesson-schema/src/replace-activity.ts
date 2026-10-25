import type { EditorState, Transaction } from '@tiptap/pm/state';
import { activityToNode } from './convert.js';
import type { Activity } from './lesson.js';

export type ReplaceActivityResult = { ok: true; tr: Transaction } | { ok: false; reason: 'changed' | 'missing' };

/**
 * The transaction that puts an accepted AI Suggestion into the document: the
 * Activity with the suggestion's id is replaced, but only while it is still
 * exactly as the suggestion saw it.
 *
 * LCG-25: the workspace compared the Activity with the suggestion's "before" and
 * then waited on the server before replacing it unconditionally, so a colleague's
 * edit that arrived in between was wiped. The comparison and the replacement now
 * happen together, against the state the transaction is built from.
 */
export function replaceActivity(state: EditorState, before: Activity, after: Activity): ReplaceActivityResult {
  let found: { pos: number; node: ReturnType<EditorState['doc']['child']> } | undefined;
  state.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === 'activity' && node.attrs.id === before.id) {
      found = { pos, node };
      return false;
    }
    return node.type.name !== 'activity';
  });
  if (!found) return { ok: false, reason: 'missing' };
  if (!found.node.eq(state.schema.nodeFromJSON(activityToNode(before)))) return { ok: false, reason: 'changed' };
  const replacement = state.schema.nodeFromJSON(activityToNode(after));
  return { ok: true, tr: state.tr.replaceWith(found.pos, found.pos + found.node.nodeSize, replacement) };
}
