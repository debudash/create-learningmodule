'use client';

import { documentToLesson, type Lesson } from '@lcg/lesson-schema';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { useEffect } from 'react';
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
  /** The Lesson's workflow status allows editing (the server decides too). */
  editable: boolean;
  onLessonChange?: (lesson: Lesson | undefined) => void;
  onPresenceChange?: (people: Presence[]) => void;
}

/** The collaborative Lesson editor. Shows nothing until the stored document has synced. */
export function LessonEditor(props: Props) {
  const session = useCollaboration(props.lessonId, props.token);
  if (session?.failure) {
    return <p className="rounded-md bg-danger-soft p-4 text-danger">Could not open this Lesson: {session.failure}</p>;
  }
  if (!session?.synced) return <p className="p-4 text-ink-soft">Opening the Lesson…</p>;
  return <BoundEditor {...props} session={session} />;
}

function BoundEditor({ session, user, editable, onLessonChange, onPresenceChange }: Props & { session: Session }) {
  const canEdit = editable && !session.readOnly;
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
