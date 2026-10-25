import { activityToNode, type Activity } from '@lcg/lesson-schema';
import { Extension, type Editor } from '@tiptap/react';

/**
 * Lets an Activity ask the workspace for an AI Suggestion about itself. The
 * suggestion is shown outside the document, to the person who asked only, until
 * they accept it (story 123).
 */
export const AiSuggestionRequests = Extension.create<unknown, { request?: (activityId: string) => void }>({
  name: 'aiSuggestions',
  addStorage: () => ({}),
});

export function requestSuggestion(editor: Editor, activityId: string): void {
  (editor.storage.aiSuggestions as { request?: (id: string) => void }).request?.(activityId);
}

export function onSuggestionRequest(editor: Editor, request: ((activityId: string) => void) | undefined): void {
  (editor.storage.aiSuggestions as { request?: (id: string) => void }).request = request;
}

/**
 * Applies an accepted AI Suggestion: replaces the Activity with the same id, as
 * one ordinary edit that syncs to everyone. Returns false if it is no longer there.
 */
export function replaceActivity(editor: Editor, activity: Activity): boolean {
  let found: { pos: number; size: number } | undefined;
  editor.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === 'activity' && node.attrs.id === activity.id) {
      found = { pos, size: node.nodeSize };
      return false;
    }
    return node.type.name !== 'activity';
  });
  if (!found) return false;
  const replacement = editor.schema.nodeFromJSON(activityToNode(activity));
  editor.view.dispatch(editor.state.tr.replaceWith(found.pos, found.pos + found.size, replacement).scrollIntoView());
  return true;
}
