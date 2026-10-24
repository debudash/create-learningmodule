import { currentFailingChecks, latestAiReview, lessonChecks, lessonHistory, listUsers, workspaceLesson } from '@lcg/db';
import { availableActions, isEditable, isSelfApproval } from '@lcg/domain';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';
import { db } from '@/server/db';
import { collaborationToken, requireUser } from '@/server/session';
import { HistoryPanel } from './HistoryPanel';
import { WorkflowBar } from './WorkflowBar';
import { Workspace } from './Workspace';

export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const user = await requireUser();
  const lesson = await workspaceLesson(db, (await params).lessonId);
  if (!lesson) notFound();
  const history = await lessonHistory(db, lesson.id);
  const checks = await lessonChecks(db, lesson.id);
  const aiChecks = checks.filter((c) => c.source === 'ai-review' && c.current);
  const lastReview = await latestAiReview(db, lesson.id);
  const failingChecks = await currentFailingChecks(db, lesson.id);
  const actor = { kind: 'user' as const, id: user.id, role: user.role };
  const colleagues = user.role === 'approver' ? (await listUsers(db)).map(({ id, name }) => ({ id, name })) : [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
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
          {lesson.assignee && <p className="mt-1 text-sm text-ink-soft">Assigned to {lesson.assignee.name}</p>}
        </div>
        <WorkflowBar
          lessonId={lesson.id}
          transitionCount={lesson.transitionCount}
          actions={availableActions(lesson.status, actor)}
          assignee={lesson.assignee}
          userId={user.id}
          colleagues={colleagues}
          selfApproval={isSelfApproval(actor, lesson.editorIds)}
          failingChecks={failingChecks}
        />
      </div>
      {lesson.changesRequested && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          <strong>Changes requested</strong> by {lesson.changesRequested.by}: “{lesson.changesRequested.reason}”
        </div>
      )}
      {lesson.status === 'approved' && (
        <p className="mb-4 rounded-md bg-support-soft px-3 py-2 text-sm text-support">
          This Lesson is Approved and read-only. An Approver can Reopen it to make changes.
        </p>
      )}
      <Workspace
        lessonId={lesson.id}
        token={await collaborationToken()}
        user={{ name: user.name }}
        outline={lesson.outline}
        aiChecks={aiChecks.map(({ createdAt: _createdAt, current: _current, ...result }) => result)}
        {...(lastReview ? { lastReview } : {})}
        history={<HistoryPanel lessonId={lesson.id} history={history} canRestore={isEditable(lesson.status)} />}
      />
    </div>
  );
}
