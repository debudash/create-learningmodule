'use server';

import { publishUnit } from '@lcg/db';
import { revalidatePath } from 'next/cache';
import { db } from '@/server/db';
import type { ActionResult } from '@/server/action-result';
import { currentActor } from '@/server/session';

export async function publishUnitAction(unitId: string): Promise<ActionResult> {
  const result = await publishUnit(db, { unitId, actor: await currentActor() });
  revalidatePath(`/units/${unitId}`);
  revalidatePath(`/units/${unitId}/publish`);
  return result.ok ? { ok: true, message: `Published as Release ${result.releaseNumber}.` } : result;
}
