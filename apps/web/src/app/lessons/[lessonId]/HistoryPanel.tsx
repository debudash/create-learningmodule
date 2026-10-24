'use client';

import type { LessonHistory } from '@lcg/db';
import { LESSON_STATUS_LABELS, type LessonStatus } from '@lcg/domain';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { restoreVersionAction } from './actions';

const REASON_LABELS: Record<string, string> = {
  generated: 'Generated',
  regenerated: 'Regenerated',
  replaced: 'Before regenerating',
  submitted: 'Submitted',
  approved: 'Approved',
  published: 'Published',
  restored: 'Restored',
};

const when = (date: Date) =>
  new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** The Lesson's story: Versions (compare, restore), workflow events and Generation Attempts. */
export function HistoryPanel({ lessonId, history, canRestore }: { lessonId: string; history: LessonHistory; canRestore: boolean }) {
  const router = useRouter();
  const [compare, setCompare] = useState<string[]>([]);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const toggle = (id: string) =>
    setCompare((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids.slice(-1), id]));
  const [newer, older] = [...compare].sort(
    (a, b) => history.versions.findIndex((v) => v.id === a) - history.versions.findIndex((v) => v.id === b),
  );

  return (
    <div className="space-y-5">
      <section>
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Versions</h3>
          {compare.length === 2 && (
            <Link href={`/lessons/${lessonId}/compare?from=${older}&to=${newer}`} className="text-accent hover:underline">
              Compare
            </Link>
          )}
        </div>
        <p className="text-xs text-ink-faint">Tick two to compare them.</p>
        <ul className="mt-1 space-y-1">
          {history.versions.map((version) => (
            <li key={version.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={compare.includes(version.id)}
                onChange={() => toggle(version.id)}
                aria-label={`Compare version ${version.number}`}
              />
              <span className="flex-1">
                v{version.number} {REASON_LABELS[version.reason] ?? version.reason}
                <span className="block text-xs text-ink-faint">
                  {version.actorName ?? 'Generated'} · {when(version.createdAt)}
                </span>
              </span>
              {canRestore && version !== history.versions[0] && (
                <button
                  type="button"
                  disabled={pending}
                  className="text-xs text-accent hover:underline"
                  onClick={() =>
                    startTransition(async () => {
                      const result = await restoreVersionAction(lessonId, version.id);
                      setMessage(result.ok ? `Restored v${version.number} as a new Version.` : result.message);
                      router.refresh();
                    })
                  }
                >
                  Restore
                </button>
              )}
            </li>
          ))}
        </ul>
        {message && <p className="mt-1 text-xs text-ink-soft">{message}</p>}
      </section>

      <section>
        <h3 className="font-medium">Workflow</h3>
        <ul className="mt-1 space-y-2">
          {history.events.map((event, i) => (
            <li key={i}>
              {LESSON_STATUS_LABELS[event.toStatus as LessonStatus]}
              <span className="text-ink-faint"> · {event.actorName ?? 'Generation'} · {when(event.createdAt)}</span>
              {event.selfApproval && <span className="ml-1 rounded bg-eld-soft px-1 text-xs text-eld">Self-Approval</span>}
              {event.overFailingChecks && <span className="ml-1 rounded bg-danger-soft px-1 text-xs text-danger">Over failing checks</span>}
              {event.reason && <p className="text-xs text-ink-soft">“{event.reason}”</p>}
            </li>
          ))}
        </ul>
      </section>

      {history.attempts.length > 0 && (
        <section>
          <h3 className="font-medium">Generation Attempts</h3>
          <ul className="mt-1 space-y-2 text-xs text-ink-soft">
            {history.attempts.map((attempt, i) => (
              <li key={i}>
                <span className="text-ink">{attempt.outcome}</span> · {attempt.model} ({attempt.mode}) · $
                {attempt.costUsd.toFixed(3)} · {(attempt.durationMs / 1000).toFixed(0)}s
                {attempt.guidanceVersion !== null && ` · Guidance v${attempt.guidanceVersion}`}
                {attempt.extraInstructions && <span className="block">Instructions: {attempt.extraInstructions}</span>}
                {attempt.failureReason && <span className="block text-danger">{attempt.failureReason}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
