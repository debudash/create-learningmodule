'use server';

import { saveGuidance } from '@lcg/db';
import { revalidatePath } from 'next/cache';
import { db } from '@/server/db';
import { requireUser } from '@/server/session';

export async function saveGuidanceAction(unitId: string, text: string): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const saved = await saveGuidance(db, { unitId, text, authorId: user.id });
  if (!saved.ok) return saved;
  revalidatePath(`/units/${unitId}/guidance`);
  return { ok: true, message: `Saved as version ${saved.version}. Lessons generated from now on use it.` };
}
