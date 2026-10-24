'use client';

import { LESSON_TYPE_LABELS } from '@lcg/lesson-schema';
import type { ImportProposal, OutlineLesson, Resolution, StandardRef } from '@lcg/outline';
import { OutlineIssues } from './OutlineIssues';

/** The Unit metadata as the Editor is editing it (form text; becomes UnitEdits). */
export interface UnitFields {
  title: string;
  grade: string;
  unitNumber: string;
  anchorTitle: string;
  anchorAuthor: string;
  isbn: string;
  performanceTask: string;
}

export function unitFieldsOf({ unit }: ImportProposal): UnitFields {
  return {
    title: unit.title,
    grade: String(unit.grade || ''),
    unitNumber: String(unit.unitNumber || ''),
    anchorTitle: unit.anchorText.title,
    anchorAuthor: unit.anchorText.author,
    isbn: unit.anchorText.isbn ?? '',
    performanceTask: unit.performanceTask ?? '',
  };
}

const FIELD_LABELS: { key: keyof UnitFields; label: string; wide?: boolean; numeric?: boolean }[] =
  [
    { key: 'title', label: 'Unit title', wide: true },
    { key: 'grade', label: 'Grade', numeric: true },
    { key: 'unitNumber', label: 'Unit number', numeric: true },
    { key: 'anchorTitle', label: 'Anchor text title' },
    { key: 'anchorAuthor', label: 'Anchor text author' },
    { key: 'isbn', label: 'Anchor text ISBN' },
    { key: 'performanceTask', label: 'Performance Task', wide: true },
  ];

/** Step 2: what the tool understood from the Outline, and the Outline Issues to decide on. */
export function ImportPreview({
  proposal,
  fields,
  onFieldsChange,
  resolutions,
  onResolutionsChange,
}: {
  proposal: ImportProposal;
  fields: UnitFields;
  onFieldsChange: (fields: UnitFields) => void;
  resolutions: Resolution[];
  onResolutionsChange: (resolutions: Resolution[]) => void;
}) {
  const flexDays = proposal.lessons.filter((l) => l.lessonType === 'flex-day').length;
  const issueLessons = new Set(proposal.issues.map((i) => i.lessonKey));

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-serif text-xl font-semibold">Unit</h2>
        <p className="text-sm text-ink-soft">
          Read from the Outline. Correct anything that is wrong.
        </p>
        <div className="mt-3 grid gap-3 rounded-xl border border-line bg-paper-raised p-4 md:grid-cols-4">
          {FIELD_LABELS.map(({ key, label, wide, numeric }) => (
            <label key={key} className={wide ? 'md:col-span-2' : ''}>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                {label}
              </span>
              <input
                value={fields[key]}
                inputMode={numeric ? 'numeric' : undefined}
                onChange={(e) => onFieldsChange({ ...fields, [key]: e.target.value })}
                className="w-full rounded-md border border-line bg-paper px-2 py-1.5 focus:border-accent focus:outline-none"
              />
            </label>
          ))}
        </div>
      </section>

      <OutlineIssues
        issues={proposal.issues}
        lessons={proposal.lessons}
        resolutions={resolutions}
        onChange={onResolutionsChange}
      />

      <section>
        <h2 className="font-serif text-xl font-semibold">Lessons</h2>
        <p className="text-sm text-ink-soft">
          {proposal.lessons.length} Lessons in {proposal.arcs.length} Arcs, including {flexDays}{' '}
          Flex Day
          {flexDays === 1 ? '' : 's'}
          {proposal.statedDayTotal !== undefined &&
            `; the Outline's day total says ${proposal.statedDayTotal}`}
          .
        </p>
        {proposal.arcs.map((arc) => (
          <div key={arc.key} className="mt-5">
            <h3 className="font-serif text-lg font-semibold">{arc.name}</h3>
            {arc.description && (
              <p className="line-clamp-2 max-w-4xl text-sm text-ink-soft">{arc.description}</p>
            )}
            <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-paper-raised">
              <table className="w-full text-left text-sm">
                <thead className="bg-paper-sunk text-xs uppercase tracking-wide text-ink-soft">
                  <tr>
                    <th className="px-3 py-2">Lesson</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Lesson Type</th>
                    <th className="px-3 py-2">Focus</th>
                    <th className="px-3 py-2">Supporting</th>
                    <th className="px-3 py-2">ELD</th>
                    <th className="px-3 py-2">Media Literacy</th>
                    <th className="px-3 py-2 text-right">Vocabulary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {proposal.lessons
                    .filter((l) => l.arcKey === arc.key)
                    .map((lesson) => (
                      <LessonRow
                        key={lesson.key}
                        lesson={lesson}
                        hasIssues={issueLessons.has(lesson.key)}
                      />
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function LessonRow({ lesson, hasIssues }: { lesson: OutlineLesson; hasIssues: boolean }) {
  return (
    <tr id={`lesson-${lesson.key}`} className="align-top">
      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-soft">
        {lesson.key}
        {hasIssues && (
          <span
            title="Has Outline Issues"
            className="ml-1 inline-block h-2 w-2 rounded-full bg-eld"
          />
        )}
      </td>
      <td className="min-w-56 px-3 py-2">
        <span className="block font-medium">{lesson.title}</span>
        {lesson.textDependentQuestion && (
          <span
            className="line-clamp-1 block text-xs text-ink-soft"
            title={lesson.textDependentQuestion}
          >
            {lesson.textDependentQuestion}
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2">{LESSON_TYPE_LABELS[lesson.lessonType]}</td>
      <Codes refs={lesson.focusStandards} />
      <Codes refs={lesson.supportingStandards} />
      <Codes refs={lesson.eldStandards} />
      <Codes refs={lesson.mediaLiteracyStandards} />
      <td className="px-3 py-2 text-right tabular-nums">{lesson.vocabulary.length}</td>
    </tr>
  );
}

function Codes({ refs }: { refs: StandardRef[] }) {
  return (
    <td className="px-3 py-2 font-mono text-xs text-ink-soft">
      {refs.length === 0 ? (
        <span className="text-ink-faint">–</span>
      ) : (
        refs.map((r) => r.code).join(', ')
      )}
    </td>
  );
}
