'use client';

import { CHECK_LABELS, countChecks, runRuleChecks, type CheckOutlineFacts, type QualityCheckResult } from '@lcg/domain';
import type { LastAiReview } from '@lcg/db';
import type { Lesson } from '@lcg/lesson-schema';
import { useMemo, useState, useTransition } from 'react';
import { describeCounts, OUTCOME_BADGE } from '@/components/CheckBadge';
import { requestReviewAction } from './actions';


function scrollToActivity(id: string | undefined) {
  if (!id) return;
  document.querySelector(`[data-activity-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * The Lesson's Quality Checks: the Rule-Based checks, recomputed live from what is in the
 * editor, and the latest AI Review, which can be run again on demand.
 */
export function ChecksPanel({
  lessonId,
  lesson,
  facts,
  aiResults,
  lastReview,
}: {
  lessonId: string;
  lesson: Lesson | undefined;
  facts: CheckOutlineFacts;
  aiResults: QualityCheckResult[];
  lastReview?: LastAiReview;
}) {
  const ruleResults = useMemo(() => (lesson ? runRuleChecks(lesson, facts) : []), [lesson, facts]);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const notPassing = [...ruleResults, ...aiResults].filter((r) => r.outcome !== 'pass');
  const counts = countChecks([...ruleResults, ...aiResults]);

  return (
    <div className="space-y-4">
      <p className="text-ink-soft">
        {describeCounts(counts)}. Checks inform the Approver; they never block approval.
      </p>
      <ResultList results={notPassing} empty="Nothing needs attention." />

      <section>
        <div className="flex items-center justify-between">
          <h3 className="font-medium">AI Review</h3>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await requestReviewAction(lessonId);
                setMessage(result.message ?? (result.ok ? 'Review requested.' : undefined));
              })
            }
            className="text-xs text-accent hover:underline disabled:opacity-50"
          >
            Re-check with AI
          </button>
        </div>
        <p className="text-xs text-ink-faint">
          {reviewStatus(lastReview)}
          {message && ` ${message}`}
        </p>
        <ResultList results={aiResults} empty="No AI Review results yet." />
      </section>

      <details>
        <summary className="cursor-pointer font-medium">All Rule-Based checks ({ruleResults.length})</summary>
        <ResultList results={ruleResults} empty="Open the Lesson to run the checks." />
      </details>
    </div>
  );
}

function reviewStatus(review: LastAiReview | undefined): string {
  if (!review) return 'Not reviewed yet.';
  if (!review.current) return 'The last AI Review judged an earlier draft; re-check to review this one.';
  if (review.outcome === 'unavailable') return 'Replay mode has no recorded AI Review of this content.';
  if (review.outcome === 'unreadable') return 'The last AI Review could not be read; it is being retried.';
  return `Last reviewed ${new Date(review.at).toLocaleString('en-US')}.`;
}

function ResultList({ results, empty }: { results: QualityCheckResult[]; empty: string }) {
  if (results.length === 0) return <p className="mt-1 text-xs text-ink-faint">{empty}</p>;
  return (
    <ul className="mt-2 space-y-2">
      {results.map((result, i) => (
        <li key={`${result.checkId}-${i}`}>
          <button
            type="button"
            onClick={() => scrollToActivity(result.location)}
            className={`w-full text-left ${result.location ? 'cursor-pointer hover:underline' : 'cursor-default'}`}
          >
            <span className={`mr-2 rounded px-1.5 py-0.5 text-xs font-medium ${OUTCOME_BADGE[result.outcome]}`}>{result.outcome}</span>
            <span className="text-xs font-medium text-ink-soft">{CHECK_LABELS[result.checkId]}</span>
            <span className="mt-0.5 block text-sm">{result.message}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
