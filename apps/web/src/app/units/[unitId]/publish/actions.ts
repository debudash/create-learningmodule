'use server';

import { publishUnit } from '@lcg/db';
import { revalidatePath } from 'next/cache';
import { db } from '@/server/db';
import { requireUser } from '@/server/session';

export async function publishUnitAction(unitId: string): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const result = await publishUnit(db, { unitId, actor: { kind: 'user', id: user.id, role: user.role } });
  revalidatePath(`/units/${unitId}`);
  revalidatePath(`/units/${unitId}/publish`);
  return result.ok ? { ok: true, message: `Published as Release ${result.releaseNumber}.` } : result;
}
