import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv.js';
import { fetchGoogleSheetCsv, toCsvExportUrl } from './google-sheets.js';

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

describe('fetchGoogleSheetCsv', () => {
  const link = 'https://docs.google.com/spreadsheets/d/abc123/edit#gid=7';
  const respond = (status: number, body: string, contentType = 'text/csv') =>
    (async () => new Response(body, { status, headers: { 'content-type': contentType } })) as typeof fetch;

  it('downloads the CSV export of the linked tab', async () => {
    let requested = '';
    const fetchImpl = (async (url: string | URL | Request) => {
      requested = String(url);
      return new Response('a,b', { status: 200, headers: { 'content-type': 'text/csv' } });
    }) as typeof fetch;
    expect(await fetchGoogleSheetCsv(link, fetchImpl)).toEqual({ ok: true, csv: 'a,b' });
    expect(requested).toBe('https://docs.google.com/spreadsheets/d/abc123/export?format=csv&gid=7');
  });

  it.each([
    ['a private sheet (sign-in page)', respond(200, '<html>', 'text/html; charset=utf-8'), 'not-shared'],
    ['a forbidden sheet', respond(403, ''), 'not-shared'],
    ['a missing sheet', respond(404, ''), 'not-found'],
    ['a server error', respond(500, ''), 'unreachable'],
  ] as const)('explains %s', async (_case, fetchImpl, reason) => {
    const result = await fetchGoogleSheetCsv(link, fetchImpl);
    expect(result).toMatchObject({ ok: false, reason });
    if (!result.ok) expect(result.message.length).toBeGreaterThan(10);
  });

  it('explains a network failure and a link that is not a sheet', async () => {
    const offline = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    expect(await fetchGoogleSheetCsv(link, offline)).toMatchObject({ reason: 'unreachable' });
    expect(await fetchGoogleSheetCsv('https://example.com', offline)).toMatchObject({
      reason: 'not-a-sheets-link',
    });
  });
});
