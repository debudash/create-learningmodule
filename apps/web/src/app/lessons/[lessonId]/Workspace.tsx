'use client';

import { SECTION_TITLES, type Lesson } from '@lcg/lesson-schema';
import type { OutlineLesson } from '@lcg/outline';
import { useCallback, useState } from 'react';
import { StudentViewPanel } from '@/components/StudentViewPanel';
import { LessonEditor, type Presence } from '@/editor/LessonEditor';

interface Props {
  lessonId: string;
  token: string;
  user: { name: string };
  outline: OutlineLesson;
}

type View = 'teacher' | 'student';

export function Workspace({ lessonId, token, user, outline }: Props) {
  const [view, setView] = useState<View>('teacher');
  const [lesson, setLesson] = useState<Lesson>();
  const [people, setPeople] = useState<Presence[]>([]);
  const onLessonChange = useCallback((next: Lesson | undefined) => next && setLesson(next), []);

  return (
    <div className="grid grid-cols-[12rem_minmax(0,1fr)_20rem] gap-6">
      <nav className="sticky top-6 self-start text-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Sections</div>
        <ul className="mt-2 space-y-1">
          {lesson?.sections.map((section) => (
            <li key={section.kind}>
              <a href={`#section-${section.kind}`} className="flex justify-between rounded px-2 py-1 hover:bg-paper-sunk">
                <span>{section.title || SECTION_TITLES[section.kind]}</span>
                <span className="tabular-nums text-ink-faint">
                  {section.activities.reduce((sum, a) => sum + a.minutes, 0)}
                </span>
              </a>
            </li>
          ))}
        </ul>
        {lesson && (
          <div className="mt-3 border-t border-line px-2 pt-2 text-ink-soft">
            Total{' '}
            <span className="tabular-nums">
              {lesson.sections.flatMap((s) => s.activities).reduce((sum, a) => sum + a.minutes, 0)}
            </span>{' '}
            / 50 min
          </div>
        )}
      </nav>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="inline-flex rounded-lg border border-line bg-paper-raised p-0.5 text-sm">
            {(['teacher', 'student'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1 font-medium ${view === v ? 'bg-accent text-white' : 'text-ink-soft'}`}
              >
                {v === 'teacher' ? 'Teacher View' : 'Student View'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1" aria-label="People in this Lesson">
            {people.map((person, i) => (
              <span
                key={`${person.name}-${i}`}
                title={person.name}
                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: person.color }}
              >
                {person.name
                  .split(' ')
                  .map((part) => part[0])
                  .join('')}
              </span>
            ))}
          </div>
        </div>
        <div className={view === 'teacher' ? '' : 'hidden'}>
          <LessonEditor
            lessonId={lessonId}
            token={token}
            user={user}
            onLessonChange={onLessonChange}
            onPresenceChange={setPeople}
          />
        </div>
        {view === 'student' && lesson && <StudentViewPanel lesson={lesson} />}
      </div>

      <aside className="sticky top-6 self-start rounded-xl border border-line bg-paper-raised p-4 text-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Outline row</div>
        <p className="mt-1 text-ink-soft">What the instructional designer asked for.</p>
        <dl className="mt-3 space-y-3">
          {outline.textDependentQuestion && <OutlineField label="Question">{outline.textDependentQuestion}</OutlineField>}
          <OutlineField label="Description">{outline.description}</OutlineField>
          <OutlineField label="Focus Standards">{outline.focusStandards.map((s) => s.code).join(', ')}</OutlineField>
          <OutlineField label="ELD Standards">
            {outline.eldStandards.map((s) => `${s.code} (${s.description})`).join('; ')}
          </OutlineField>
          <OutlineField label="Vocabulary">{outline.vocabulary.map((v) => v.word).join(', ')}</OutlineField>
          {outline.homework && <OutlineField label="Homework">{outline.homework}</OutlineField>}
          {outline.designerNotes.length > 0 && (
            <OutlineField label="Designer Notes">{outline.designerNotes.join(' ')}</OutlineField>
          )}
        </dl>
      </aside>
    </div>
  );
}

function OutlineField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-medium text-ink">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-ink-soft">{children || 'None'}</dd>
    </div>
  );
}
