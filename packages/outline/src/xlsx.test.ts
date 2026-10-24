import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv.js';
import { parseOutlineCsv, parseOutlineRows } from './parse.js';
import { sampleOutlineCsv } from './testing.js';
import { readXlsxRows } from './xlsx.js';

async function sampleAsXlsx(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Lesson Outline');
  for (const row of parseCsv(sampleOutlineCsv())) sheet.addRow(row);
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

describe('readXlsxRows', () => {
  it('reads an XLSX Outline into the same proposal as its CSV export', async () => {
    const fromXlsx = parseOutlineRows(await readXlsxRows(await sampleAsXlsx()));
    const fromCsv = parseOutlineCsv(sampleOutlineCsv());
    expect(fromXlsx.lessons).toHaveLength(47);
    expect(fromXlsx.lessons.map((l) => l.focusStandards)).toEqual(
      fromCsv.lessons.map((l) => l.focusStandards),
    );
    expect(fromXlsx.lessons.find((l) => l.key === 'L22')!.vocabulary).toEqual(
      fromCsv.lessons.find((l) => l.key === 'L22')!.vocabulary,
    );
    expect(fromXlsx.issues.map((i) => i.id)).toEqual(fromCsv.issues.map((i) => i.id));
  });

  it('returns no rows for an empty worksheet', async () => {
    const empty = new ExcelJS.Workbook();
    empty.addWorksheet('Lesson Outline');
    expect(await readXlsxRows((await empty.xlsx.writeBuffer()) as ArrayBuffer)).toEqual([]);
  });
});
