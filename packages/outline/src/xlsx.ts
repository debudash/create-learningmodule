import ExcelJS from 'exceljs';

/**
 * Reads the first worksheet of an XLSX file into rows of cell text, the same
 * shape parseCsv produces. Rich text and line breaks inside cells are kept.
 */
export async function readXlsxRows(data: ArrayBuffer | Uint8Array): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data instanceof Uint8Array ? toArrayBuffer(data) : data);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows: string[][] = [];
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= sheet.columnCount; c++) cells.push(row.getCell(c).text ?? '');
    rows.push(cells);
  }
  return rows;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
