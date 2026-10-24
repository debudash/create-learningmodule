import { workspaceLesson } from '@lcg/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';
import { db } from '@/server/db';
import { collaborationToken, requireUser } from '@/server/session';
import { Workspace } from './Workspace';

export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const user = await requireUser();
  const lesson = await workspaceLesson(db, (await params).lessonId);
  if (!lesson) notFound();

  return (
    <div>
      <div className="mb-6">
        <div className="text-sm text-ink-soft">
          <Link href={`/units/${lesson.unit.id}`} className="hover:underline">
            Grade {lesson.unit.grade} · Unit {lesson.unit.unitNumber}: {lesson.unit.title}
          </Link>{' '}
          / {lesson.arc.name} / {lesson.key}
        </div>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="font-serif text-2xl font-semibold">{lesson.title}</h1>
          <StatusBadge status={lesson.status} />
        </div>
        {lesson.status === 'approved' && (
          <p className="mt-2 rounded-md bg-support-soft px-3 py-2 text-sm text-support">
            This Lesson is Approved and read-only. An Approver can Reopen it to make changes.
          </p>
        )}
      </div>
      <Workspace
        lessonId={lesson.id}
        token={await collaborationToken()}
        user={{ name: user.name }}
        outline={lesson.outline}
      />
    </div>
  );
}
