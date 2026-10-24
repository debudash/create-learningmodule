const SHEETS_URL = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)/;

/**
 * Turns a Google Sheets link (edit, view or share URL) into its CSV export URL,
 * keeping the tab (gid) when the link names one. Returns undefined for anything
 * that is not a Google Sheets link.
 */
export function toCsvExportUrl(link: string): string | undefined {
  const url = link.trim();
  const id = SHEETS_URL.exec(url)?.[1];
  if (!id) return undefined;
  const gid = /[#?&]gid=(\d+)/.exec(url)?.[1];
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
}

export type SheetFetchFailure = 'not-a-sheets-link' | 'not-shared' | 'not-found' | 'unreachable';

export type SheetFetchResult =
  | { ok: true; csv: string }
  | { ok: false; reason: SheetFetchFailure; message: string };

const MESSAGES: Record<SheetFetchFailure, string> = {
  'not-a-sheets-link': "That is not a Google Sheets link. Paste the link from the sheet's Share button.",
  'not-shared':
    'The sheet is not shared publicly. Set it to "Anyone with the link can view", or upload it as a CSV or XLSX file.',
  'not-found': 'No sheet was found at that link. Check that it is the right link.',
  unreachable: 'Google Sheets could not be reached. Try again, or upload the Outline as a file.',
};

const fail = (reason: SheetFetchFailure): SheetFetchResult => ({
  ok: false,
  reason,
  message: MESSAGES[reason],
});

/** Downloads a public Google Sheet as CSV, explaining in plain words why when it cannot. */
export async function fetchGoogleSheetCsv(
  link: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SheetFetchResult> {
  const url = toCsvExportUrl(link);
  if (!url) return fail('not-a-sheets-link');

  let response: Response;
  try {
    response = await fetchImpl(url, { redirect: 'follow' });
  } catch {
    return fail('unreachable');
  }
  if (response.status === 404) return fail('not-found');
  if (response.status === 401 || response.status === 403) return fail('not-shared');
  if (!response.ok) return fail('unreachable');
  // A private sheet redirects to Google's sign-in page, which answers 200 with HTML.
  if ((response.headers.get('content-type') ?? '').includes('text/html')) return fail('not-shared');
  return { ok: true, csv: await response.text() };
}
