import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv.js';
import { toCsvExportUrl } from './google-sheets.js';

describe('parseCsv', () => {
  it('handles quoted fields with commas, doubled quotes and newlines', () => {
    expect(parseCsv('a,"b, c","say ""hi""\nthere"\r\nd,,e\n')).toEqual([
      ['a', 'b, c', 'say "hi"\nthere'],
      ['d', '', 'e'],
    ]);
  });

  it('ignores a byte-order mark and keeps a last row without a newline', () => {
    expect(parseCsv('﻿x,y\n1,2')).toEqual([
      ['x', 'y'],
      ['1', '2'],
    ]);
  });
});

describe('toCsvExportUrl', () => {
  it('builds the export URL from an edit link, keeping the tab', () => {
    expect(
      toCsvExportUrl('https://docs.google.com/spreadsheets/d/1Ofig_QnE/edit?usp=sharing#gid=1723306320'),
    ).toBe('https://docs.google.com/spreadsheets/d/1Ofig_QnE/export?format=csv&gid=1723306320');
  });

  it('omits the tab when the link names none', () => {
    expect(toCsvExportUrl(' https://docs.google.com/spreadsheets/d/abc123/edit?usp=sharing ')).toBe(
      'https://docs.google.com/spreadsheets/d/abc123/export?format=csv',
    );
  });

  it('rejects other links', () => {
    expect(toCsvExportUrl('https://example.com/spreadsheets/d/abc')).toBeUndefined();
  });
});
