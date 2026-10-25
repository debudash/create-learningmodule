'use client';

import { documentToLesson, type Lesson } from '@lcg/lesson-schema';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { useEffect } from 'react';
import { onSuggestionRequest } from './ai-suggestions';
import { colorFor, useCollaboration, type Collaboration as Session } from './collaboration';
import { lessonEditorExtensions } from './extensions';

export interface Presence {
  name: string;
  color: string;
}

interface Props {
  lessonId: string;
  token: string;
  user: { name: string };
  onLessonChange?: (lesson: Lesson | undefined) => void;
  onPresenceChange?: (people: Presence[]) => void;
  /** The editor, once it exists (to apply accepted AI Suggestions). */
  onEditorReady?: (editor: Editor | null) => void;
  /** An Activity's "Ask AI" was pressed. */
  onRequestSuggestion?: (activityId: string) => void;
}

/** The collaborative Lesson editor. Shows nothing until the stored document has synced. */
export function LessonEditor(props: Props) {
  const session = useCollaboration(props.lessonId, props.token);
  if (session?.failure) {
    return <p className="rounded-md bg-danger-soft p-4 text-danger">Could not open this Lesson: {session.failure}</p>;
  }
  if (!session?.ready) return <p className="p-4 text-ink-soft">Opening the Lesson…</p>;
  return (
    <>
      <SaveStatus session={session} />
      <BoundEditor {...props} session={session} />
    </>
  );
}

function BoundEditor({
  session,
  user,
  onLessonChange,
  onPresenceChange,
  onEditorReady,
  onRequestSuggestion,
}: Props & { session: Session }) {
  // The collaboration server decides, and re-decides whenever the Lesson's status changes (LCG-8).
  const canEdit = !session.readOnly;
  const editor = useEditor({
    immediatelyRender: false,
    editable: canEdit,
    extensions: [
      ...lessonEditorExtensions(),
      Collaboration.configure({ document: session.document }),
      CollaborationCursor.configure({ provider: session.provider, user: { name: user.name, color: colorFor(user.name) } }),
    ],
    editorProps: { attributes: { class: 'lesson-editor' } },
  });

  useEffect(() => {
    editor?.setEditable(canEdit);
  }, [editor, canEdit]);

  useEffect(() => {
    onEditorReady?.(editor);
    if (editor) onSuggestionRequest(editor, onRequestSuggestion);
  }, [editor, onEditorReady, onRequestSuggestion]);

  useLessonUpdates(editor, onLessonChange);
  usePresence(session, onPresenceChange);

  return <EditorContent editor={editor} />;
}

function useLessonUpdates(editor: Editor | null, onLessonChange?: (lesson: Lesson | undefined) => void) {
  useEffect(() => {
    if (!editor || !onLessonChange) return;
    const report = () => {
      const result = documentToLesson(editor.getJSON());
      onLessonChange(result.ok ? result.lesson : undefined);
    };
    report();
    editor.on('update', report);
    return () => {
      editor.off('update', report);
    };
  }, [editor, onLessonChange]);
}

function usePresence(session: Session, onPresenceChange?: (people: Presence[]) => void) {
  useEffect(() => {
    const awareness = session.provider.awareness;
    if (!awareness || !onPresenceChange) return;
    const report = () => {
      const people = [...awareness.getStates().values()]
        .map((state) => state.user as Presence | undefined)
        .filter((p): p is Presence => Boolean(p?.name));
      onPresenceChange(people);
    };
    report();
    awareness.on('change', report);
    return () => awareness.off('change', report);
  }, [session, onPresenceChange]);
}

/** Whether this person's changes have reached the server. */
function SaveStatus({ session }: { session: Session }) {
  const [label, tone] =
    session.connection !== 'connected'
      ? ['Offline: changes are kept on this device and sent when you reconnect', 'bg-eld-soft text-eld']
      : session.unsyncedChanges > 0
        ? ['Saving…', 'bg-paper-sunk text-ink-soft']
        : session.readOnly
          ? ['Read-only', 'bg-paper-sunk text-ink-soft']
          : ['All changes saved', 'bg-support-soft text-support'];
  return (
    <div className="mb-3 flex justify-end">
      <span role="status" className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
        {label}
      </span>
    </div>
  );
}
