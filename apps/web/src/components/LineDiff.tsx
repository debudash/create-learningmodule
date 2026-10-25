import { diffArrays } from 'diff';

/** Lines removed and added between two texts, counted. */
export function lineChanges(before: string[], after: string[]) {
  const changes = diffArrays(before, after);
  const total = (kind: 'added' | 'removed') => changes.filter((c) => c[kind]).reduce((n, c) => n + c.count!, 0);
  return { changes, added: total('added'), removed: total('removed') };
}

/** A line-by-line comparison: removed lines struck through, added lines highlighted. */
export function LineDiff({ changes }: { changes: ReturnType<typeof lineChanges>['changes'] }) {
  return (
    <ol className="overflow-hidden rounded-xl border border-line bg-paper-raised font-mono text-xs leading-relaxed">
      {changes.flatMap((change, i) =>
        change.value.map((line, j) => (
          <li
            key={`${i}-${j}`}
            className={`whitespace-pre-wrap px-3 py-0.5 ${
              change.added ? 'bg-support-soft text-support' : change.removed ? 'bg-danger-soft text-danger line-through' : 'text-ink-soft'
            }`}
          >
            {change.added ? '+ ' : change.removed ? '− ' : '  '}
            {line}
          </li>
        )),
      )}
    </ol>
  );
}
