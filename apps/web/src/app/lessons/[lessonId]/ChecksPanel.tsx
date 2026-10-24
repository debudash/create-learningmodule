'use client';

import { CHECK_LABELS, runRuleChecks, summarizeChecks, type CheckOutlineFacts, type QualityCheckResult } from '@lcg/domain';
import type { Lesson } from '@lcg/lesson-schema';
import { useMemo, useState, useTransition } from 'react';
import { requestReviewAction } from './actions';

const BADGE = {
  pass: 'bg-support-soft text-support',
  warn: 'bg-eld-soft text-eld',
  fail: 'bg-danger-soft text-danger',
} as const;

function scrollToActivity(id: string | undefined) {
  if (!id) return;
  document.querySelector(`[data-activity-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * The Lesson's Quality Checks: the rule checks, recomputed live from what is in the
 * editor, and the latest AI Review, which can be run again on demand.
 */
export function ChecksPanel({
  lessonId,
  lesson,
  facts,
  aiResults,
  reviewedAt,
}: {
  lessonId: string;
  lesson: Lesson | undefined;
  facts: CheckOutlineFacts;
  aiResults: QualityCheckResult[];
  reviewedAt?: Date;
}) {
  const ruleResults = useMemo(() => (lesson ? runRuleChecks(lesson, facts) : []), [lesson, facts]);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const notPassing = [...ruleResults, ...aiResults].filter((r) => r.outcome !== 'pass');
  const summary = summarizeChecks([...ruleResults, ...aiResults]);

  return (
    <div className="space-y-4">
      <p className="text-ink-soft">
        {summary.fail} failing · {summary.warn} to look at · {summary.pass} passing. Checks inform the Approver; they never block
        approval.
      </p>
      <ResultList results={notPassing.length > 0 ? notPassing : []} empty="Nothing needs attention." />

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
          {reviewedAt ? `Last reviewed ${new Date(reviewedAt).toLocaleString('en-US')}.` : 'Not reviewed yet.'}
          {message && ` ${message}`}
        </p>
        <ResultList results={aiResults} empty="No AI Review results yet." />
      </section>

      <details>
        <summary className="cursor-pointer font-medium">All rule checks ({ruleResults.length})</summary>
        <ResultList results={ruleResults} empty="Open the Lesson to run the checks." />
      </details>
    </div>
  );
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
            <span className={`mr-2 rounded px-1.5 py-0.5 text-xs font-medium ${BADGE[result.outcome]}`}>{result.outcome}</span>
            <span className="text-xs font-medium text-ink-soft">{CHECK_LABELS[result.checkId] ?? result.checkId}</span>
            <span className="mt-0.5 block text-sm">{result.message}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
