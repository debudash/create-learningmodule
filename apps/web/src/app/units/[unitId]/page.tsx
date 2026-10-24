import { unitBoard } from '@lcg/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/server/db';
import { requireUser } from '@/server/session';
import { UnitBoardView } from './UnitBoardView';

export default async function UnitBoardPage({ params }: { params: Promise<{ unitId: string }> }) {
  const user = await requireUser();
  const board = await unitBoard(db, (await params).unitId);
  if (!board) notFound();

  return (
    <div>
      <div className="text-sm text-ink-soft">
        <Link href="/units" className="hover:underline">
          Units
        </Link>{' '}
        / Grade {board.unit.grade} · Unit {board.unit.unitNumber}
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold">{board.unit.title}</h1>
        <Link
          href={`/units/${board.unit.id}/publish`}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:border-accent"
        >
          {board.unit.latestReleaseId ? (board.unit.hasUnpublishedChanges ? 'Publish changes' : 'Published') : 'Publish'}
        </Link>
      </div>
      {board.unit.hasUnpublishedChanges && (
        <p className="mt-2 text-sm text-eld">This Unit has Unpublished Changes since its last Release.</p>
      )}
      {board.unit.performanceTask && (
        <p className="mt-1 text-ink-soft">Performance Task: {board.unit.performanceTask}</p>
      )}
      <UnitBoardView
        unitId={board.unit.id}
        arcs={board.arcs.map(({ id, name, description }) => ({ id, name, description }))}
        initialLessons={board.lessons}
        initialCost={board.aiCostUsd}
        user={{ id: user.id, role: user.role }}
      />
    </div>
  );
}
