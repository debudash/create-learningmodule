import { unitBoard } from '@lcg/db';
import { hasOpenableContent } from '@lcg/domain';
import { LESSON_TYPE_LABELS } from '@lcg/lesson-schema';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';
import { db } from '@/server/db';
import { requireUser } from '@/server/session';

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

      {board.arcs.map((arc) => (
        <section key={arc.id} className="mt-8">
          <h2 className="font-serif text-xl font-semibold">{arc.name}</h2>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-paper-raised">
            {board.lessons
              .filter((lesson) => lesson.arcId === arc.id)
              .map((lesson) => {
                const opens = hasOpenableContent(lesson.status);
                const row = (
                  <div className="flex items-center gap-4 px-4 py-3">
                    <span className="w-10 text-sm tabular-nums text-ink-faint">{lesson.key}</span>
                    <span className="flex-1">
                      <span className="block font-medium">{lesson.title}</span>
                      <span className="block text-xs text-ink-soft">{LESSON_TYPE_LABELS[lesson.lessonType]}</span>
                    </span>
                    <StatusBadge status={lesson.status} />
                  </div>
                );
                return (
                  <li key={lesson.id}>
                    {opens ? (
                      <Link href={`/lessons/${lesson.id}`} className="block hover:bg-paper">
                        {row}
                      </Link>
                    ) : (
                      row
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
