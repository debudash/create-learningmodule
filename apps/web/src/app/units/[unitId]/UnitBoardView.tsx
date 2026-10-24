'use client';

import type { BoardLesson } from '@lcg/db';
import { availableActions, hasOpenableContent, LESSON_STATUS_LABELS, type LessonStatus, type Role } from '@lcg/domain';
import { LESSON_TYPE_LABELS } from '@lcg/lesson-schema';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import type { ActionResult } from '@/server/action-result';
import { approveLessonsAction, cancelGenerationAction, retryLessonAction, startGenerationAction } from './actions';

interface Props {
  unitId: string;
  arcs: { id: string; name: string; description: string }[];
  initialLessons: BoardLesson[];
  initialCost: number;
  user: { id: string; role: Role };
}

type Filter = 'all' | 'in-review' | 'changes-requested' | 'mine';

const FILTERS: { id: Filter; label: string; matches: (lesson: BoardLesson, userId: string) => boolean }[] = [
  { id: 'all', label: 'All', matches: () => true },
  { id: 'in-review', label: 'In Review', matches: (l) => l.status === 'in-review' },
  { id: 'changes-requested', label: 'Changes Requested', matches: (l) => l.status === 'changes-requested' },
  { id: 'mine', label: 'Assigned to me', matches: (l, userId) => l.assigneeId === userId },
];

const ACTIVE: LessonStatus[] = ['queued', 'generating'];
const PROGRESS_ORDER: LessonStatus[] = [
  'approved',
  'in-review',
  'changes-requested',
  'draft',
  'generating',
  'queued',
  'generation-failed',
  'outlined',
];
const BAR: Partial<Record<LessonStatus, string>> = {
  approved: 'bg-support',
  'in-review': 'bg-teacher',
  'changes-requested': 'bg-danger',
  draft: 'bg-eld',
  generating: 'bg-accent animate-pulse',
  queued: 'bg-accent/40',
  'generation-failed': 'bg-danger/60',
};

/** The Unit board: Lessons by Arc, generation controls, and live progress while generation runs. */
export function UnitBoardView({ unitId, arcs, initialLessons, initialCost, user }: Props) {
  const [lessons, setLessons] = useState(initialLessons);
  const [cost, setCost] = useState(initialCost);
  const [notice, setNotice] = useState<ActionResult>();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const active = lessons.some((l) => ACTIVE.includes(l.status));
  const matches = FILTERS.find((f) => f.id === filter)!.matches;
  const actor = { kind: 'user' as const, ...user };
  const approvable = (lesson: BoardLesson) => availableActions(lesson.status, actor).includes('approve');
  const canBulkApprove = availableActions('in-review', actor).includes('approve');

  useEffect(() => setLessons(initialLessons), [initialLessons]);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/units/${unitId}/board`, { cache: 'no-store' });
      if (!response.ok) return;
      const next = (await response.json()) as { lessons: BoardLesson[]; generationCostUsd: number };
      setLessons(next.lessons);
      setCost(next.generationCostUsd);
    }, 2000);
    return () => clearInterval(timer);
  }, [active, unitId]);

  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      setNotice(await action());
      const response = await fetch(`/api/units/${unitId}/board`, { cache: 'no-store' });
      if (response.ok) setLessons(((await response.json()) as { lessons: BoardLesson[] }).lessons);
      setSelected([]);
    });

  const counts = new Map<LessonStatus, number>();
  for (const lesson of lessons) counts.set(lesson.status, (counts.get(lesson.status) ?? 0) + 1);
  const outlined = counts.get('outlined') ?? 0;

  return (
    <div>
      <section className="mt-6 rounded-xl border border-line bg-paper-raised p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Generation</h2>
            <p className="text-sm text-ink-soft">
              {active
                ? `Generating: ${counts.get('generating') ?? 0} in progress, ${counts.get('queued') ?? 0} queued.`
                : outlined > 0
                  ? `${outlined} Lessons are ready to generate. Try a small batch first, adjust the Guidance, then generate the rest.`
                  : 'Every Lesson has been generated.'}
              {cost > 0 && ` Spent so far: $${cost.toFixed(2)}.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/units/${unitId}/guidance`} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:border-accent">
              Generation Guidance
            </Link>
            {outlined > 0 && (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => startGenerationAction(unitId, 'trial'))}
                  className="rounded-lg border border-accent px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft disabled:opacity-50"
                >
                  Generate 3 to try
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => startGenerationAction(unitId, 'all'))}
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  Generate all {outlined}
                </button>
              </>
            )}
            {(counts.get('queued') ?? 0) > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => cancelGenerationAction(unitId))}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-50"
              >
                Cancel queued
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-paper-sunk" aria-label="Lesson progress">
          {PROGRESS_ORDER.map((status) =>
            BAR[status] && counts.get(status) ? (
              <div
                key={status}
                className={BAR[status]}
                style={{ width: `${((counts.get(status) ?? 0) / lessons.length) * 100}%` }}
                title={`${LESSON_STATUS_LABELS[status]}: ${counts.get(status)}`}
              />
            ) : null,
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
          {PROGRESS_ORDER.filter((s) => counts.get(s)).map((status) => (
            <span key={status}>
              {LESSON_STATUS_LABELS[status]} {counts.get(status)}
            </span>
          ))}
        </div>
        {notice && (
          <p role="status" className={`mt-3 text-sm ${notice.ok ? 'text-support' : 'text-danger'}`}>
            {notice.message}
          </p>
        )}
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Show Lessons">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1 text-sm ${filter === f.id ? 'bg-accent text-white' : 'bg-paper-sunk text-ink-soft hover:text-ink'}`}
            >
              {f.label} ({lessons.filter((l) => f.matches(l, user.id)).length})
            </button>
          ))}
        </div>
        {canBulkApprove && selected.length > 0 && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() =>
                approveLessonsAction(
                  unitId,
                  lessons
                    .filter((l) => selected.includes(l.id))
                    .map((l) => ({ id: l.id, expectedTransitionCount: l.transitionCount })),
                ),
              )
            }
            className="rounded-lg bg-support px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Approve {selected.length} selected
          </button>
        )}
      </div>

      {arcs.map((arc) => {
        const shown = lessons.filter((lesson) => lesson.arcId === arc.id && matches(lesson, user.id));
        if (shown.length === 0) return null;
        return (
          <section key={arc.id} className="mt-8">
            <h2 className="font-serif text-xl font-semibold">{arc.name}</h2>
            <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-paper-raised">
              {shown.map((lesson) => (
                <li key={lesson.id} className="flex items-center">
                  {canBulkApprove && (
                    <span className="w-8 pl-3">
                      {approvable(lesson) && (
                        <input
                          type="checkbox"
                          aria-label={`Select ${lesson.key}`}
                          checked={selected.includes(lesson.id)}
                          onChange={() =>
                            setSelected((ids) => (ids.includes(lesson.id) ? ids.filter((id) => id !== lesson.id) : [...ids, lesson.id]))
                          }
                        />
                      )}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <LessonRow lesson={lesson} onRetry={() => run(() => retryLessonAction(unitId, lesson.id))} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function LessonRow({ lesson, onRetry }: { lesson: BoardLesson; onRetry: () => void }) {
  const body = (
    <div className="flex items-center gap-4 px-4 py-3">
      <span className="w-10 text-sm tabular-nums text-ink-faint">{lesson.key}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{lesson.title}</span>
        <span className="block text-xs text-ink-soft">
          {LESSON_TYPE_LABELS[lesson.lessonType]}
          {lesson.assigneeName && ` · ${lesson.assigneeName}`}
          {lesson.waitingForArc && ' · Waits for the rest of its Arc'}
          {lesson.failureReason && <span className="text-danger"> · {lesson.failureReason}</span>}
        </span>
      </span>
      {lesson.status === 'generation-failed' && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onRetry();
          }}
          className="rounded px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft"
        >
          Retry
        </button>
      )}
      <StatusBadge status={lesson.status} />
    </div>
  );
  return hasOpenableContent(lesson.status) ? (
    <Link href={`/lessons/${lesson.id}`} className="block hover:bg-paper">
      {body}
    </Link>
  ) : (
    body
  );
}
