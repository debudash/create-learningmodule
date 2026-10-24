import { listReleases, publishSummary, unitBoard } from '@lcg/db';
import { publishability } from '@lcg/domain';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/server/db';
import { requireUser } from '@/server/session';
import { PublishButton } from './PublishButton';

export default async function PublishPage({ params }: { params: Promise<{ unitId: string }> }) {
  const user = await requireUser();
  const { unitId } = await params;
  const board = await unitBoard(db, unitId);
  if (!board) notFound();
  const ready = publishability(board.lessons);
  const summary = await publishSummary(db, unitId);
  const releases = await listReleases(db, unitId);

  return (
    <div className="max-w-3xl">
      <div className="text-sm text-ink-soft">
        <Link href={`/units/${unitId}`} className="hover:underline">
          Grade {board.unit.grade} · Unit {board.unit.unitNumber}: {board.unit.title}
        </Link>{' '}
        / Publish
      </div>
      <h1 className="mt-1 font-serif text-3xl font-semibold">Publish the Unit</h1>
      <p className="mt-2 text-ink-soft">
        Publishing freezes a Unit Release of every Lesson&apos;s Approved Version for teachers. Later edits never change a
        Release; publish again to release them.
      </p>

      <section className="mt-6 rounded-xl border border-line bg-paper-raised p-5">
        {ready.ok ? (
          <p className="text-support">All {summary.lessonCount} Lessons are Approved.</p>
        ) : (
          <p className="text-danger">{ready.message}</p>
        )}
        <ul className="mt-3 space-y-1 text-sm text-ink-soft">
          <li>Self-Approved: {summary.selfApproved.length > 0 ? summary.selfApproved.join(', ') : 'none'}</li>
          <li>
            Approved over failing Quality Checks:{' '}
            {summary.approvedOverFailingChecks.length > 0 ? summary.approvedOverFailingChecks.join(', ') : 'none'}
          </li>
          {board.unit.hasUnpublishedChanges && <li className="text-eld">Changed since the last Release.</li>}
        </ul>
        <div className="mt-4">
          {user.role === 'approver' ? (
            <PublishButton unitId={unitId} disabled={!ready.ok} />
          ) : (
            <p className="text-sm text-ink-soft">Only an Approver can publish a Unit.</p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">Releases</h2>
        {releases.length === 0 ? (
          <p className="mt-2 text-ink-soft">Not published yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-paper-raised">
            {releases.map((release) => (
              <li key={release.id} className="flex items-center justify-between px-4 py-3">
                <span>
                  Release {release.number}
                  <span className="block text-sm text-ink-soft">
                    {release.publisherName}, {release.createdAt.toLocaleString('en-US')}
                  </span>
                </span>
                <span className="flex gap-4 text-sm">
                  <a href={`/api/releases/${release.id}`} className="text-accent hover:underline">
                    Download JSON
                  </a>
                  <a href={`/api/releases/${release.id}?format=newsela`} className="text-accent hover:underline">
                    Newsela format
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
