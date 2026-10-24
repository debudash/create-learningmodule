import { unitBoard } from '@lcg/db';
import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { currentUser } from '@/server/session';

/** The Unit board's Lesson states, polled while generation runs. */
export async function GET(_request: Request, { params }: { params: Promise<{ unitId: string }> }) {
  if (!(await currentUser())) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const board = await unitBoard(db, (await params).unitId);
  if (!board) return NextResponse.json({ error: 'No such Unit' }, { status: 404 });
  return NextResponse.json({ lessons: board.lessons, generationCostUsd: board.generationCostUsd });
}
