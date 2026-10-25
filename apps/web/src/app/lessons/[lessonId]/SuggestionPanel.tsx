'use client';

import { AI_EDIT_ACTIONS, AI_EDIT_LABELS, needsInstruction, type AiEditAction } from '@lcg/domain';
import { activityToLines, type Activity, type ReplaceActivityResult } from '@lcg/lesson-schema';
import { useState, useTransition } from 'react';
import { LineDiff, lineChanges } from '@/components/LineDiff';
import { acceptSuggestion } from './accept-suggestion';
import { resolveSuggestionAction, suggestEditAction } from './actions';

/** What the Editor asked the AI about: an Activity, and for Fix with AI the check to fix. */
export interface SuggestionTarget {
  activityId: string;
  action?: AiEditAction;
  instruction?: string;
}

type Proposal = { suggestionId: string; before: Activity; after: Activity };

/** Fix with AI starts from a Quality Check, so it is not offered from the menu. */
const MENU_ACTIONS = AI_EDIT_ACTIONS.filter((a) => a !== 'fix');

/**
 * An AI Suggestion for one Activity, seen only by the person who asked (story 123):
 * choose what to ask, preview the change line by line, then accept or reject it.
 * Accepting applies it in the editor as an ordinary edit.
 */
export function SuggestionPanel({
  lessonId,
  target,
  activity,
  apply,
  onClose,
}: {
  lessonId: string;
  target: SuggestionTarget;
  /** The Activity as it is in the editor now (undefined if it was deleted). */
  activity: Activity | undefined;
  /** Puts the accepted Activity into the document, unless it changed or went since the suggestion. */
  apply: (before: Activity, after: Activity) => ReplaceActivityResult;
  onClose: () => void;
}) {
  const [action, setAction] = useState<AiEditAction>(target.action ?? 'rewrite');
  const [instruction, setInstruction] = useState(target.instruction ?? '');
  const [proposal, setProposal] = useState<Proposal>();
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  const ask = () =>
    startTransition(async () => {
      if (!activity) return;
      setMessage(undefined);
      const result = await suggestEditAction(lessonId, activity, action, needsInstruction(action) ? instruction : undefined);
      if (result.ok) setProposal(result);
      else setMessage(result.message);
    });

  const resolve = (outcome: 'accepted' | 'rejected') =>
    startTransition(async () => {
      if (!proposal) return;
      const result =
        outcome === 'accepted'
          ? await acceptSuggestion({
              apply: () => apply(proposal.before, proposal.after),
              record: () => resolveSuggestionAction(proposal.suggestionId, 'accepted'),
              undo: () => apply(proposal.after, proposal.before),
            })
          : await resolveSuggestionAction(proposal.suggestionId, 'rejected');
      if (!result.ok) return setMessage(result.message);
      onClose();
    });

  if (!activity) {
    return (
      <Frame onClose={onClose}>
        <p className="text-ink-soft">That Activity is no longer in the Lesson.</p>
      </Frame>
    );
  }

  // Closing an open suggestion rejects it, so the record says what happened to it.
  const close = proposal ? () => resolve('rejected') : onClose;

  return (
    <Frame onClose={close} title={activity.title}>
      {proposal ? (
        <Preview proposal={proposal} />
      ) : (
        <div className="space-y-3">
          {target.action === 'fix' ? (
            <p className="rounded-md bg-paper-sunk p-2 text-ink-soft">Fix: {instruction}</p>
          ) : (
            <fieldset className="space-y-1">
              <legend className="font-medium">Ask the AI to</legend>
              {MENU_ACTIONS.map((a) => (
                <label key={a} className="flex items-center gap-2">
                  <input type="radio" name="ai-action" checked={action === a} onChange={() => setAction(a)} />
                  {AI_EDIT_LABELS[a]}
                </label>
              ))}
            </fieldset>
          )}
          {action === 'rewrite' && (
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="What should change? e.g. Make the directions shorter."
              rows={3}
              className="w-full rounded-md border border-line bg-paper p-2"
            />
          )}
        </div>
      )}

      {message && <p className="mt-3 text-danger">{message}</p>}

      <div className="mt-4 flex gap-2">
        {proposal ? (
          <>
            <button type="button" disabled={pending} onClick={() => resolve('accepted')} className="rounded-md bg-accent px-3 py-1.5 font-medium text-white disabled:opacity-50">
              Accept
            </button>
            <button type="button" disabled={pending} onClick={() => resolve('rejected')} className="rounded-md border border-line px-3 py-1.5 font-medium disabled:opacity-50">
              Reject
            </button>
          </>
        ) : (
          <button type="button" disabled={pending} onClick={ask} className="rounded-md bg-accent px-3 py-1.5 font-medium text-white disabled:opacity-50">
            {pending ? 'Asking the AI…' : 'Suggest a change'}
          </button>
        )}
      </div>
    </Frame>
  );
}

function Preview({ proposal }: { proposal: Proposal }) {
  const { changes, added, removed } = lineChanges(activityToLines(proposal.before), activityToLines(proposal.after));
  return (
    <div className="space-y-2">
      <p className="text-ink-soft">
        AI Suggestion: {added} lines added, {removed} removed. Only you can see it until you accept it.
      </p>
      <LineDiff changes={changes} />
    </div>
  );
}

function Frame({ title, onClose, children }: { title?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <section aria-label="AI Suggestion">
      <div className="mb-3 flex items-start justify-between gap-2 border-b border-line pb-2">
        <h3 className="font-medium">
          AI Suggestion{title && <span className="block text-xs font-normal text-ink-soft">{title}</span>}
        </h3>
        <button type="button" onClick={onClose} className="text-xs text-ink-soft hover:underline">
          Close
        </button>
      </div>
      {children}
    </section>
  );
}
