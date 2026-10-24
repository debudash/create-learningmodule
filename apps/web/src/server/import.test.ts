import ExcelJS from 'exceljs';
import { miniOutlineCsv, sampleOutlineCsv } from '@lcg/fixtures';
import type { ImportUnitInput } from '@lcg/db';
import { parseCsv, parseOutlineCsv, type Resolution } from '@lcg/outline';
import { describe, expect, it, vi } from 'vitest';
import { sealPayload, sessionSecret } from '@lcg/session';
import { checkImport, createUnitFromImport, outlineInputFromForm, readOutline } from './import';

const LINK =
  'https://docs.google.com/spreadsheets/d/1OfigF5jtwagY8jJMk5g536tAgykkIR6xHGa0Bic_QnE/edit?usp=sharing';
const bytes = (text: string) => new TextEncoder().encode(text);

const csvResponse = (csv: string) =>
  new Response(csv, { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8' } });

async function sampleXlsx(): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Lesson Outline');
  for (const row of parseCsv(sampleOutlineCsv())) sheet.addRow(row);
  return new Uint8Array((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
}

describe('readOutline', () => {
  it('reads a shared Google Sheet into a proposal and records the link', async () => {
    const fetchImpl = vi.fn(async () => csvResponse(sampleOutlineCsv()));
    const result = await readOutline({ kind: 'google-sheets', link: LINK }, fetchImpl);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.lessons).toHaveLength(47);
    expect(result.source).toEqual({ kind: 'google-sheets', reference: LINK });
  });

  it("passes on the Sheets reader's plain-language reason when a link cannot be read", async () => {
    const privateSheet = async () =>
      new Response('<html>Sign in</html>', { headers: { 'content-type': 'text/html' } });
    const result = await readOutline({ kind: 'google-sheets', link: LINK }, privateSheet);
    expect(result).toEqual({ ok: false, message: expect.stringMatching(/not shared publicly/) });

    const offline = async () => {
      throw new TypeError('fetch failed');
    };
    const unreachable = await readOutline({ kind: 'google-sheets', link: LINK }, offline);
    expect(unreachable).toEqual({
      ok: false,
      message: expect.stringMatching(/could not be reached/),
    });

    const notSheets = await readOutline({
      kind: 'google-sheets',
      link: 'https://example.com/outline',
    });
    expect(notSheets).toEqual({
      ok: false,
      message: expect.stringMatching(/not a Google Sheets link/),
    });
  });

  it('reads an uploaded CSV', async () => {
    const result = await readOutline({
      kind: 'file',
      name: 'Outline.CSV',
      bytes: bytes(sampleOutlineCsv()),
    });
    expect(result.ok && result.proposal).toEqual(parseOutlineCsv(sampleOutlineCsv()));
    expect(result.ok && result.source).toEqual({ kind: 'file', reference: 'Outline.CSV' });
  });

  it('reads an uploaded XLSX into the same Lessons as the CSV', async () => {
    const result = await readOutline({
      kind: 'file',
      name: 'g6-u4.xlsx',
      bytes: await sampleXlsx(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.lessons.map((l) => l.key)).toEqual(
      parseOutlineCsv(sampleOutlineCsv()).lessons.map((l) => l.key),
    );
  });

  it('explains unrecognised and unreadable files', async () => {
    const pdf = await readOutline({ kind: 'file', name: 'outline.pdf', bytes: bytes('%PDF') });
    expect(pdf).toEqual({ ok: false, message: expect.stringMatching(/not a CSV or XLSX file/) });

    const xls = await readOutline({ kind: 'file', name: 'outline.xls', bytes: bytes('x') });
    expect(xls).toEqual({
      ok: false,
      message: expect.stringMatching(/Save the Outline as \.xlsx or \.csv/),
    });

    const broken = await readOutline({
      kind: 'file',
      name: 'outline.xlsx',
      bytes: bytes('not a zip'),
    });
    expect(broken).toEqual({
      ok: false,
      message: expect.stringMatching(/could not be opened as an Excel file/),
    });
  });

  it('says so when a file is not a Unit Outline', async () => {
    const result = await readOutline({
      kind: 'file',
      name: 'budget.csv',
      bytes: bytes('Item,Cost\nPens,4\n'),
    });
    expect(result).toEqual({
      ok: false,
      message: expect.stringMatching(/does not look like a Unit Outline/),
    });
  });
});

describe('outlineInputFromForm', () => {
  it('prefers a chosen file over a link', async () => {
    const form = new FormData();
    form.set('link', LINK);
    form.set('file', new File([miniOutlineCsv()], 'mini.csv'));
    const input = await outlineInputFromForm(form);
    expect(input).toMatchObject({ kind: 'file', name: 'mini.csv' });
  });

  it('uses the link when no file is chosen, and asks for one or the other', async () => {
    const form = new FormData();
    form.set('link', `  ${LINK} `);
    form.set('file', new File([], ''));
    expect(await outlineInputFromForm(form)).toEqual({ kind: 'google-sheets', link: LINK });
    expect(await outlineInputFromForm(new FormData())).toEqual({
      message: expect.stringMatching(/Paste a Google Sheets link/),
    });
  });
});

describe('createUnitFromImport', () => {
  const proposal = parseOutlineCsv(sampleOutlineCsv());
  const blocking = proposal.issues.filter((i) => i.severity === 'blocking');
  const resolveAll: Resolution[] = blocking.map((i) => ({
    issueId: i.id,
    action: 'accept-suggestion',
  }));
  const source = { kind: 'file' as const, reference: 'g6-u4.csv' };
  const base = {
    proposal,
    unitEdits: {},
    source,
    seal: sealPayload(JSON.stringify({ proposal, source }), sessionSecret()),
    guidance: 'Keep it warm.',
    actorId: 'user-1',
  };

  it('re-confirms on the server and refuses while Blocking issues are unresolved', async () => {
    const save = vi.fn(async () => 'unit-1');
    const result = await createUnitFromImport({ ...base, resolutions: resolveAll.slice(1) }, save);
    expect(result).toEqual({
      ok: false,
      errors: [expect.stringMatching(/^1 Blocking Outline Issue still needs a decision \(L4\)/)],
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('passes on resolution and metadata problems', async () => {
    const save = vi.fn(async () => 'unit-1');
    const bad: Resolution[] = [
      ...resolveAll.slice(1),
      { issueId: blocking[0]!.id, action: 'replace', value: 'RL.6.99' },
    ];
    const result = await createUnitFromImport(
      { ...base, resolutions: bad, unitEdits: { grade: 0 } },
      save,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain('The Unit needs a grade from 1 to 12.');
    expect(result.errors.some((e) => e.includes('RL.6.99'))).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses empty Generation Guidance', async () => {
    const save = vi.fn(async () => 'unit-1');
    const result = await createUnitFromImport(
      { ...base, resolutions: resolveAll, guidance: '  ' },
      save,
    );
    expect(result).toEqual({ ok: false, errors: ['Generation Guidance cannot be empty.'] });
  });

  it('saves the confirmed import with the Unit edits, source, actor and guidance', async () => {
    const save = vi.fn(async (_unit: ImportUnitInput) => 'unit-1');
    const result = await createUnitFromImport(
      { ...base, resolutions: resolveAll, unitEdits: { unitNumber: 4, title: 'Lightning Thief' } },
      save,
    );
    expect(result).toEqual({ ok: true, unitId: 'unit-1' });
    const saved = save.mock.calls[0]![0];
    expect(saved.confirmed.unit.title).toBe('Lightning Thief');
    expect(saved.confirmed.lessons).toHaveLength(47);
    expect(saved).toMatchObject({
      source: base.source,
      actorId: 'user-1',
      guidance: 'Keep it warm.',
    });
  });
});

describe('checkImport', () => {
  it('agrees with the final import', () => {
    const proposal = parseOutlineCsv(sampleOutlineCsv());
    const source = { kind: 'file' as const, reference: 'g6-u4.csv' };
    const seal = sealPayload(JSON.stringify({ proposal, source }), sessionSecret());
    expect(checkImport({ proposal, source, seal, resolutions: [], unitEdits: {} }).ok).toBe(false);
    const all: Resolution[] = proposal.issues
      .filter((i) => i.severity === 'blocking')
      .map((i) => ({ issueId: i.id, action: 'remove' }));
    expect(checkImport({ proposal, source, seal, resolutions: all, unitEdits: {} })).toEqual({ ok: true });
  });
});

describe('the import proposal seal', () => {
  // LCG-13 regression. Found by: Phase 3 spec review (the server trusted the proposal sent back by the browser).
  it('LCG-13: refuses a proposal changed in the browser, such as one with its Blocking issues deleted', async () => {
    const read = await readOutline({ kind: 'file', name: 'g6-u4.csv', bytes: bytes(sampleOutlineCsv()) });
    if (!read.ok) throw new Error(read.message);
    const tampered = { ...read.proposal, issues: read.proposal.issues.filter((i) => i.severity !== 'blocking') };
    const decisions = { proposal: tampered, source: read.source, seal: read.seal, resolutions: [], unitEdits: {} };

    expect(checkImport(decisions)).toEqual({ ok: false, errors: [expect.stringMatching(/Read the Outline again/)] });
    const save = vi.fn(async () => 'unit-1');
    const created = await createUnitFromImport({ ...decisions, guidance: 'g', actorId: 'user-1' }, save);
    expect(created.ok).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });
});
