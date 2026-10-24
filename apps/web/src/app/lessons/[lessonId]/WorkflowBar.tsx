'use client';

import type { LessonActionType } from '@lcg/domain';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { regenerateLessonAction } from '@/app/units/[unitId]/actions';
import type { ActionResult } from '@/server/action-result';
import { assignLessonAction, reviewLessonAction } from './actions';

interface Props {
  lessonId: string;
  transitionCount: number;
  /** Actions the domain rules allow this person in the Lesson's current status. */
  actions: LessonActionType[];
  assignee: { id: string; name: string } | null;
  userId: string;
  /** People an Approver can assign the Lesson to (empty for Editors). */
  colleagues: { id: string; name: string }[];
  /** This Approver edited the Lesson; approving it will be recorded as Self-Approval. */
  selfApproval: boolean;
}

type Dialog = 'request-changes' | 'reopen' | 'regenerate' | undefined;

const PRIMARY = 'rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';
const SECONDARY = 'rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:border-accent disabled:opacity-50';

/** The workflow buttons for one Lesson: only what this person may do now. */
export function WorkflowBar({ lessonId, transitionCount, actions, assignee, userId, colleagues, selfApproval }: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>();
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const can = (action: LessonActionType) => actions.includes(action);

  const run = (act: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await act();
      setMessage(result.message);
      if (result.ok) {
        setDialog(undefined);
        setText('');
      }
      router.refresh();
    });

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {colleagues.length > 0 ? (
          <select
            aria-label="Assignee"
            value={assignee?.id ?? ''}
            disabled={pending}
            onChange={(e) => run(() => assignLessonAction(lessonId, e.target.value || null))}
            className="rounded-lg border border-line bg-paper-raised px-2 py-1.5 text-sm"
          >
            <option value="">Unassigned</option>
            {colleagues.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        ) : assignee?.id === userId ? (
          <button type="button" className={SECONDARY} disabled={pending} onClick={() => run(() => assignLessonAction(lessonId, null))}>
            Unclaim
          </button>
        ) : (
          <button type="button" className={SECONDARY} disabled={pending} onClick={() => run(() => assignLessonAction(lessonId, userId))}>
            {assignee ? `Take over from ${assignee.name}` : 'Claim'}
          </button>
        )}
        {can('regenerate') && (
          <button type="button" className={SECONDARY} disabled={pending} onClick={() => setDialog('regenerate')}>
            Regenerate
          </button>
        )}
        {can('submit') && (
          <button
            type="button"
            className={PRIMARY}
            disabled={pending}
            onClick={() => run(() => reviewLessonAction(lessonId, { type: 'submit' }, transitionCount))}
          >
            Submit for review
          </button>
        )}
        {can('request-changes') && (
          <button type="button" className={SECONDARY} disabled={pending} onClick={() => setDialog('request-changes')}>
            Request changes
          </button>
        )}
        {can('approve') && (
          <button
            type="button"
            className={PRIMARY}
            disabled={pending}
            title={selfApproval ? 'You edited this Lesson; this will be recorded as Self-Approval.' : undefined}
            onClick={() => run(() => reviewLessonAction(lessonId, { type: 'approve' }, transitionCount))}
          >
            {selfApproval ? 'Approve (Self-Approval)' : 'Approve'}
          </button>
        )}
        {can('reopen') && (
          <button type="button" className={SECONDARY} disabled={pending} onClick={() => setDialog('reopen')}>
            Reopen
          </button>
        )}
      </div>

      {dialog && (
        <div className="w-full max-w-lg rounded-lg border border-line bg-paper-raised p-3 text-sm shadow-sm">
          <label className="block font-medium">
            {dialog === 'request-changes' && 'What should the Editors change?'}
            {dialog === 'reopen' && 'Why does this Approved Lesson need changes?'}
            {dialog === 'regenerate' && 'Anything the new draft should do differently? (optional)'}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-line px-2 py-1.5 font-normal focus:border-accent focus:outline-none"
            />
          </label>
          {dialog === 'regenerate' && (
            <p className="mt-1 text-ink-soft">
              Regenerating replaces this Lesson&apos;s content with a new draft. The current content is kept in History.
            </p>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className={SECONDARY} onClick={() => setDialog(undefined)}>
              Cancel
            </button>
            <button
              type="button"
              className={PRIMARY}
              disabled={pending || (dialog !== 'regenerate' && !text.trim())}
              onClick={() =>
                run(() =>
                  dialog === 'regenerate'
                    ? regenerateLessonAction(lessonId, text, transitionCount)
                    : reviewLessonAction(lessonId, { type: dialog, reason: text }, transitionCount),
                )
              }
            >
              {dialog === 'request-changes' ? 'Request changes' : dialog === 'reopen' ? 'Reopen' : 'Regenerate'}
            </button>
          </div>
        </div>
      )}
      {message && (
        <p role="status" className="text-sm text-ink-soft">
          {message}
        </p>
      )}
    </div>
  );
}
