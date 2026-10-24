'use server';

import { importUnit } from '@lcg/db';
import { redirect } from 'next/navigation';
import { db } from '@/server/db';
import {
  checkImport,
  createUnitFromImport,
  outlineInputFromForm,
  readOutline,
  type CheckResult,
  type CreateUnitInput,
  type ImportDecisions,
  type ReadOutlineResult,
} from '@/server/import';
import { requireUser } from '@/server/session';

/** Step 1: read the pasted link or uploaded file into an import proposal. */
export async function readOutlineAction(form: FormData): Promise<ReadOutlineResult> {
  await requireUser();
  const input = await outlineInputFromForm(form);
  if ('message' in input) return { ok: false, message: input.message };
  return readOutline(input);
}

/** Step 2: check the Editor's decisions before moving on to Generation Guidance. */
export async function checkImportAction(decisions: ImportDecisions): Promise<CheckResult> {
  await requireUser();
  return checkImport(decisions);
}

/** Step 3: confirm the import again on the server, create the Unit and open it. */
export async function createUnitAction(
  input: Omit<CreateUnitInput, 'actorId'>,
): Promise<{ errors: string[] }> {
  const user = await requireUser();
  const result = await createUnitFromImport({ ...input, actorId: user.id }, (unit) =>
    importUnit(db, unit),
  );
  if (!result.ok) return { errors: result.errors };
  redirect(`/units/${result.unitId}`);
}
