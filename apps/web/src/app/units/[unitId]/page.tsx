import { unitBoard } from '@lcg/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/server/db';
import { requireUser } from '@/server/session';
import { UnitBoardView } from './UnitBoardView';

export default async function UnitBoardPage({ params }: { params: Promise<{ unitId: string }> }) {
  await requireUser();
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
      <h1 className="mt-1 font-serif text-3xl font-semibold">{board.unit.title}</h1>
      {board.unit.performanceTask && (
        <p className="mt-1 text-ink-soft">Performance Task: {board.unit.performanceTask}</p>
      )}
      <UnitBoardView
        unitId={board.unit.id}
        arcs={board.arcs.map(({ id, name, description }) => ({ id, name, description }))}
        initialLessons={board.lessons}
        initialCost={board.generationCostUsd}
      />
    </div>
  );
}
