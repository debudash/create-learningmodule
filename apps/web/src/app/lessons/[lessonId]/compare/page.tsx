import { lessonHistory, readVersion, workspaceLesson } from '@lcg/db';
import { VERSION_REASON_LABELS } from '@lcg/domain';
import { lessonToLines } from '@lcg/lesson-schema';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LineDiff, lineChanges } from '@/components/LineDiff';
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
  const { changes, added, removed } = lineChanges(lessonToLines(before), lessonToLines(after));

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
      <div className="mt-4">
        <LineDiff changes={changes} />
      </div>
    </div>
  );
}
