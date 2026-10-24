'use server';

import { saveGuidance } from '@lcg/db';
import { revalidatePath } from 'next/cache';
import { db } from '@/server/db';
import { requireUser } from '@/server/session';

export async function saveGuidanceAction(unitId: string, text: string): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  if (!text.trim()) return { ok: false, message: 'Generation Guidance cannot be empty.' };
  const version = await saveGuidance(db, { unitId, text, authorId: user.id });
  revalidatePath(`/units/${unitId}/guidance`);
  return { ok: true, message: `Saved as version ${version}. Lessons generated from now on use it.` };
}
