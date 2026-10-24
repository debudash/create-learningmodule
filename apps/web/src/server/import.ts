import type { ImportUnitInput, OutlineSource } from '@lcg/db';
import {
  confirmImport,
  fetchGoogleSheetCsv,
  parseOutlineCsv,
  parseOutlineRows,
  readXlsxRows,
  type ImportProposal,
  type Resolution,
  type UnitEdits,
} from '@lcg/outline';

/** Server-side steps of the New Unit wizard, kept free of Next so they can be tested directly. */

export type OutlineInput =
  | { kind: 'google-sheets'; link: string }
  | { kind: 'file'; name: string; bytes: Uint8Array };

export type ReadOutlineResult =
  | { ok: true; proposal: ImportProposal; source: OutlineSource }
  | { ok: false; message: string };

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const NOT_AN_OUTLINE =
  'This does not look like a Unit Outline. We look for a header row with columns such as "Lesson #", ' +
  '"Type of Lesson", "Lesson Description" and "Focus Standards".';

/** Picks the link or the file from the wizard's first step; a chosen file wins over a link. */
export async function outlineInputFromForm(
  form: FormData,
): Promise<OutlineInput | { message: string }> {
  const file = form.get('file');
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES)
      return { message: 'That file is larger than 5 MB, which is too big for a Unit Outline.' };
    return { kind: 'file', name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
  }
  const link = String(form.get('link') ?? '').trim();
  if (link) return { kind: 'google-sheets', link };
  return { message: 'Paste a Google Sheets link or choose a CSV or XLSX file.' };
}

/** Reads a Unit Outline from a Google Sheets link or an uploaded file into an import proposal. */
export async function readOutline(
  input: OutlineInput,
  fetchImpl: typeof fetch = fetch,
): Promise<ReadOutlineResult> {
  if (input.kind === 'google-sheets') {
    const sheet = await fetchGoogleSheetCsv(input.link, fetchImpl);
    if (!sheet.ok) return { ok: false, message: sheet.message };
    return toProposal(parseOutlineCsv(sheet.csv), { kind: 'google-sheets', reference: input.link });
  }

  const extension = /\.([a-z0-9]+)$/i.exec(input.name)?.[1]?.toLowerCase();
  if (extension === 'csv') {
    return toProposal(parseOutlineCsv(new TextDecoder().decode(input.bytes)), {
      kind: 'file',
      reference: input.name,
    });
  }
  if (extension === 'xlsx') {
    let rows: string[][];
    try {
      rows = await readXlsxRows(input.bytes);
    } catch {
      return {
        ok: false,
        message: `"${input.name}" could not be opened as an Excel file. Try exporting it again, or as CSV.`,
      };
    }
    return toProposal(parseOutlineRows(rows), { kind: 'file', reference: input.name });
  }
  if (extension === 'xls') {
    return {
      ok: false,
      message:
        'Older .xls files cannot be read. Save the Outline as .xlsx or .csv and upload that.',
    };
  }
  return {
    ok: false,
    message: `"${input.name}" is not a CSV or XLSX file. Export the Outline as one of those and try again.`,
  };
}

function toProposal(proposal: ImportProposal, source: OutlineSource): ReadOutlineResult {
  if (proposal.issues.some((i) => i.kind === 'missing-column'))
    return { ok: false, message: NOT_AN_OUTLINE };
  if (proposal.lessons.length === 0) {
    return {
      ok: false,
      message:
        'The Outline has its columns but no Lesson rows ("Lesson 1", "Lesson 2", …) were found.',
    };
  }
  return { ok: true, proposal, source };
}

export interface ImportDecisions {
  proposal: ImportProposal;
  resolutions: Resolution[];
  unitEdits: UnitEdits;
}

export type CheckResult = { ok: true } | { ok: false; errors: string[] };

/** Runs the same confirmation the import will, and explains in plain words what is still in the way. */
export function checkImport({ proposal, resolutions, unitEdits }: ImportDecisions): CheckResult {
  const result = confirmImport(proposal, resolutions, unitEdits);
  return result.ok ? { ok: true } : { ok: false, errors: confirmErrors(result) };
}

function confirmErrors(result: {
  unresolved: { lessonKey?: string }[];
  errors: string[];
}): string[] {
  const { unresolved, errors } = result;
  if (unresolved.length === 0) return errors;
  const where = [...new Set(unresolved.map((i) => i.lessonKey).filter(Boolean))].join(', ');
  const count = `${unresolved.length} Blocking Outline Issue${unresolved.length === 1 ? ' still needs' : 's still need'} a decision`;
  return [...errors, where ? `${count} (${where}).` : `${count}.`];
}

export interface CreateUnitInput extends ImportDecisions {
  source: OutlineSource;
  guidance: string;
  actorId: string;
}

export type CreateUnitResult = { ok: true; unitId: string } | { ok: false; errors: string[] };

/**
 * Creates the Unit from the Editor's decisions. The proposal and resolutions come
 * from the browser, so the import is confirmed again here rather than trusted.
 */
export async function createUnitFromImport(
  input: CreateUnitInput,
  save: (unit: ImportUnitInput) => Promise<string>,
): Promise<CreateUnitResult> {
  const guidance = input.guidance.trim();
  if (!guidance) return { ok: false, errors: ['Generation Guidance cannot be empty.'] };
  const result = confirmImport(input.proposal, input.resolutions, input.unitEdits);
  if (!result.ok) return { ok: false, errors: confirmErrors(result) };
  const source: OutlineSource = {
    kind: input.source.kind === 'google-sheets' ? 'google-sheets' : 'file',
    reference: String(input.source.reference),
  };
  const unitId = await save({
    confirmed: result.confirmed,
    source,
    actorId: input.actorId,
    guidance,
  });
  return { ok: true, unitId };
}
