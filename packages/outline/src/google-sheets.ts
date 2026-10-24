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
