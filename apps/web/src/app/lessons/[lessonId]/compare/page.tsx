import { lessonHistory, readVersion, workspaceLesson } from '@lcg/db';
import { VERSION_REASON_LABELS } from '@lcg/domain';
import { lessonToLines } from '@lcg/lesson-schema';
import { diffArrays } from 'diff';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/server/db';
import { requireUser } from '@/server/session';

/** Two Lesson Versions side by side as one list of lines: removed, added and unchanged. */
export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireUser();
  const { lessonId } = await params;
  const { from, to } = await searchParams;
  const lesson = await workspaceLesson(db, lessonId);
  if (!lesson || !from || !to) notFound();
  const [before, after] = await Promise.all([readVersion(db, lessonId, from), readVersion(db, lessonId, to)]);
  if (!before || !after) notFound();
  const versions = (await lessonHistory(db, lessonId)).versions;
  const label = (id: string) => {
    const version = versions.find((v) => v.id === id)!;
    return `v${version.number} (${VERSION_REASON_LABELS[version.reason]})`;
  };
  const changes = diffArrays(lessonToLines(before), lessonToLines(after));
  const added = changes.filter((c) => c.added).reduce((n, c) => n + c.count!, 0);
  const removed = changes.filter((c) => c.removed).reduce((n, c) => n + c.count!, 0);

  return (
    <div>
      <div className="text-sm text-ink-soft">
        <Link href={`/lessons/${lessonId}`} className="hover:underline">
          {lesson.key} {lesson.title}
        </Link>{' '}
        / Compare
      </div>
      <h1 className="mt-1 font-serif text-2xl font-semibold">
        {label(from)} → {label(to)}
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        {added} lines added, {removed} removed. Comparing the AI&apos;s original with the Approved Version shows how much
        people changed.
      </p>
      <ol className="mt-4 overflow-hidden rounded-xl border border-line bg-paper-raised font-mono text-xs leading-relaxed">
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
    </div>
  );
}
