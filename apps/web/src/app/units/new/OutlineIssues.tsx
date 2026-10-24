'use client';

import { LESSON_TYPE_LABELS, LESSON_TYPES, type LessonType } from '@lcg/lesson-schema';
import type {
  OutlineIssue,
  OutlineIssueKind,
  OutlineLesson,
  Resolution,
  StandardsField,
} from '@lcg/outline';
import {
  applyToGroup,
  groupIssues,
  resolutionOptions,
  unresolvedBlocking,
  type IssueGroup,
  type ResolutionChoice,
} from '@lcg/outline/issues';
import { useState } from 'react';
import { SmallButton } from '@/editor/fields';

const KIND_LABELS: Record<OutlineIssueKind, string> = {
  'malformed-standard': 'Incomplete standard code',
  'unknown-standard': 'Standard code that does not exist',
  'eld-description-mismatch': 'ELD description does not match the code',
  'metadata-conflict': 'Unit details disagree',
  'filename-mismatch': 'Filename does not match the Lesson',
  'day-total-mismatch': 'Day total does not match',
  'arc-mismatch': 'Arc name does not match',
  'unknown-lesson-type': 'Unrecognised Lesson Type',
  'missing-column': 'Missing column',
};

const FIELD_LABELS: Record<StandardsField, string> = {
  focusStandards: 'Focus Standards',
  supportingStandards: 'Supporting Standards',
  eldStandards: 'ELD Standards',
  mediaLiteracyStandards: 'Media Literacy Standards',
};

/** The Outline Issues, Blocking first, each with the ways it can be resolved. */
export function OutlineIssues({
  issues,
  lessons,
  resolutions,
  onChange,
}: {
  issues: OutlineIssue[];
  lessons: OutlineLesson[];
  resolutions: Resolution[];
  onChange: (resolutions: Resolution[]) => void;
}) {
  if (issues.length === 0) {
    return (
      <section>
        <h2 className="font-serif text-xl font-semibold">Outline Issues</h2>
        <p className="mt-1 text-support">No Outline Issues were found.</p>
      </section>
    );
  }

  const groups = groupIssues(issues);
  const open = unresolvedBlocking(issues, resolutions).length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const byId = new Map(resolutions.map((r) => [r.issueId, r]));
  const titles = new Map(lessons.map((l) => [l.key, l.title]));

  const setOne = (issueId: string, choice: ResolutionChoice | undefined) => {
    const rest = resolutions.filter((r) => r.issueId !== issueId);
    onChange(choice ? [...rest, { ...choice, issueId } as Resolution] : rest);
  };

  const blockingGroups = groups.filter((g) => g.severity === 'blocking');
  const warningGroups = groups.filter((g) => g.severity === 'warning');

  return (
    <section>
      <h2 className="font-serif text-xl font-semibold">Outline Issues</h2>
      <p className="mt-1 text-sm">
        <span className={open > 0 ? 'font-semibold text-danger' : 'text-support'}>
          {open > 0
            ? `${open} Blocking issue${open === 1 ? '' : 's'} to resolve`
            : 'All Blocking issues resolved'}
        </span>
        <span className="text-ink-soft">
          {' '}
          · {warnings} Warning{warnings === 1 ? '' : 's'}
        </span>
      </p>
      <p className="mt-1 max-w-3xl text-sm text-ink-soft">
        A standard code always means its official text, so a code that is wrong changes what the
        Lesson teaches. Blocking issues must be resolved before the Unit can be created. Warnings
        you leave alone are kept as written.
      </p>

      {[
        { title: 'Blocking', list: blockingGroups },
        { title: 'Warnings', list: warningGroups },
      ].map(
        ({ title, list }) =>
          list.length > 0 && (
            <div key={title} className="mt-5">
              <h3
                className={`text-sm font-semibold uppercase tracking-wide ${title === 'Blocking' ? 'text-danger' : 'text-eld'}`}
              >
                {title}
              </h3>
              <ul className="mt-2 space-y-3">
                {list.map((group) => (
                  <GroupCard
                    key={group.key}
                    group={group}
                    titles={titles}
                    byId={byId}
                    onSetOne={setOne}
                    onApplyAll={(choice) => onChange(applyToGroup(resolutions, group, choice))}
                  />
                ))}
              </ul>
            </div>
          ),
      )}
    </section>
  );
}

function GroupCard({
  group,
  titles,
  byId,
  onSetOne,
  onApplyAll,
}: {
  group: IssueGroup;
  titles: Map<string, string>;
  byId: Map<string, Resolution>;
  onSetOne: (issueId: string, choice: ResolutionChoice | undefined) => void;
  onApplyAll: (choice: ResolutionChoice) => void;
}) {
  const first = group.issues[0]!;
  const options = resolutionOptions(first);
  const tone = group.severity === 'blocking' ? 'border-l-danger' : 'border-l-eld';

  return (
    <li className={`rounded-xl border border-l-4 border-line bg-paper-raised p-4 ${tone}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {KIND_LABELS[group.kind]}
      </div>
      {group.raw && <div className="mt-1 font-mono text-sm">{group.raw}</div>}
      <p className="mt-1 text-sm">{group.message}</p>
      {group.suggestion && (
        <p className="mt-1 text-sm text-ink-soft">
          Suggestion: <span className="font-mono text-accent">{group.suggestion}</span>
        </p>
      )}

      {group.issues.length > 1 && options.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-paper-sunk px-3 py-2">
          <span className="text-sm font-medium">Apply to all {group.issues.length} like this:</span>
          <ResolutionControls issue={first} options={options} onChoose={onApplyAll} />
        </div>
      )}

      <ul className="mt-3 divide-y divide-line border-t border-line">
        {group.issues.map((issue) => (
          <li key={issue.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
            <span className="min-w-56 flex-1">
              {issue.lessonKey ? (
                <a href={`#lesson-${issue.lessonKey}`} className="hover:underline">
                  <span className="tabular-nums text-ink-soft">{issue.lessonKey}</span>{' '}
                  <span className="font-medium">{titles.get(issue.lessonKey)}</span>
                </a>
              ) : (
                <span className="font-medium">Whole Unit</span>
              )}
              {issue.field && <span className="text-ink-soft"> · {FIELD_LABELS[issue.field]}</span>}
            </span>
            <IssueResolution
              issue={issue}
              options={options}
              resolution={byId.get(issue.id)}
              onChoose={(choice) => onSetOne(issue.id, choice)}
            />
          </li>
        ))}
      </ul>
    </li>
  );
}

function IssueResolution({
  issue,
  options,
  resolution,
  onChoose,
}: {
  issue: OutlineIssue;
  options: Resolution['action'][];
  resolution: Resolution | undefined;
  onChoose: (choice: ResolutionChoice | undefined) => void;
}) {
  if (options.length === 0) {
    return (
      <span className="text-danger">
        This cannot be fixed here; correct the Outline and read it again.
      </span>
    );
  }
  if (!resolution)
    return <ResolutionControls issue={issue} options={options} onChoose={onChoose} />;
  return (
    <span className="flex items-center gap-2">
      <span className="rounded-full bg-support-soft px-2 py-0.5 text-xs font-medium text-support">
        {describe(resolution, issue)}
      </span>
      <SmallButton onClick={() => onChoose(undefined)}>Change</SmallButton>
    </span>
  );
}

function describe(resolution: Resolution, issue: OutlineIssue): string {
  switch (resolution.action) {
    case 'accept-suggestion':
      return `Use ${issue.suggestion}`;
    case 'replace':
      return `Replace with ${LESSON_TYPE_LABELS[resolution.value as LessonType] ?? resolution.value}`;
    case 'remove':
      return 'Remove';
    case 'accept':
      return 'Keep as written';
  }
}

/** The buttons for resolving one issue (or a whole group, with the same choices). */
function ResolutionControls({
  issue,
  options,
  onChoose,
}: {
  issue: OutlineIssue;
  options: Resolution['action'][];
  onChoose: (choice: ResolutionChoice) => void;
}) {
  const [replacing, setReplacing] = useState(false);
  const [value, setValue] = useState('');

  if (issue.kind === 'unknown-lesson-type') {
    return (
      <select
        value=""
        onChange={(e) => onChoose({ action: 'replace', value: e.target.value })}
        className="rounded-md border border-line bg-paper px-2 py-1 text-sm"
      >
        <option value="" disabled>
          Choose the Lesson Type…
        </option>
        {LESSON_TYPES.map((type) => (
          <option key={type} value={type}>
            {LESSON_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
    );
  }

  if (replacing) {
    const submit = () => value.trim() && onChoose({ action: 'replace', value: value.trim() });
    return (
      <span className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          placeholder="e.g. RL.6.2"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
            if (e.key === 'Escape') setReplacing(false);
          }}
          className="w-36 rounded-md border border-line bg-paper px-2 py-1 font-mono text-sm focus:border-accent focus:outline-none"
        />
        <SmallButton onClick={submit}>Replace</SmallButton>
        <SmallButton onClick={() => setReplacing(false)}>Cancel</SmallButton>
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-1">
      {options.includes('accept-suggestion') && (
        <button
          type="button"
          onClick={() => onChoose({ action: 'accept-suggestion' })}
          className="rounded bg-accent-soft px-2 py-1 text-xs font-medium text-accent hover:bg-accent hover:text-white"
        >
          Use suggestion
        </button>
      )}
      {options.includes('replace') && (
        <SmallButton onClick={() => setReplacing(true)}>Replace with…</SmallButton>
      )}
      {options.includes('remove') && (
        <SmallButton tone="danger" onClick={() => onChoose({ action: 'remove' })}>
          Remove
        </SmallButton>
      )}
      {options.includes('accept') && (
        <SmallButton onClick={() => onChoose({ action: 'accept' })}>Keep as written</SmallButton>
      )}
    </span>
  );
}
