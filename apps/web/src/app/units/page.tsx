import { listUnits } from '@lcg/db';
import { LESSON_STATUS_LABELS, type LessonStatus } from '@lcg/domain';
import Link from 'next/link';
import { db } from '@/server/db';
import { requireUser } from '@/server/session';

const PROGRESS: { status: LessonStatus; className: string }[] = [
  { status: 'approved', className: 'bg-support' },
  { status: 'in-review', className: 'bg-teacher' },
  { status: 'changes-requested', className: 'bg-danger' },
  { status: 'draft', className: 'bg-eld' },
];

export default async function UnitsPage() {
  await requireUser();
  const units = await listUnits(db);
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl font-semibold">Units</h1>
        <Link href="/units/new" className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:opacity-90">
          New Unit
        </Link>
      </div>
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {units.map((unit) => (
          <li key={unit.id}>
            <Link
              href={`/units/${unit.id}`}
              className="block rounded-xl border border-line bg-paper-raised p-5 hover:border-accent"
            >
              <div className="text-sm text-ink-soft">
                Grade {unit.grade} · Unit {unit.unitNumber}
              </div>
              <div className="mt-1 font-serif text-xl font-semibold">{unit.title}</div>
              <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-paper-sunk">
                {PROGRESS.map(({ status, className }) => (
                  <div
                    key={status}
                    className={className}
                    style={{ width: `${((unit.statusCounts[status] ?? 0) / Math.max(unit.lessonCount, 1)) * 100}%` }}
                    title={`${LESSON_STATUS_LABELS[status]}: ${unit.statusCounts[status] ?? 0}`}
                  />
                ))}
              </div>
              <div className="mt-2 text-sm text-ink-soft">
                {unit.statusCounts.approved ?? 0} of {unit.lessonCount} Lessons Approved
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
