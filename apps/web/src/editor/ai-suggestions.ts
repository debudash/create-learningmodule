import { replaceActivity, type Activity, type ReplaceActivityResult } from '@lcg/lesson-schema';
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
 * Applies an accepted AI Suggestion as one ordinary edit that syncs to everyone,
 * unless the Activity has changed or gone since the suggestion was made (LCG-25).
 */
export function applySuggestion(editor: Editor, before: Activity, after: Activity): ReplaceActivityResult {
  const result = replaceActivity(editor.state, before, after);
  if (result.ok) editor.view.dispatch(result.tr.scrollIntoView());
  return result;
}
