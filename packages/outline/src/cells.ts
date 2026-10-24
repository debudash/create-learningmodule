import { hasStandard, normalizeCode, suggestEldCode, type Framework } from '@lcg/standards';
import type {
  EldStandardRef,
  OutlineIssue,
  PageRange,
  StandardRef,
  StandardsField,
  VocabularyWord,
} from './types.js';

const BULLET = /^[\s\u00a0]*[•◦▪●\-*][\s\u00a0]*/;
const DASH = /[–—-]/;

export const FRAMEWORK_OF: Record<StandardsField, Framework> = {
  focusStandards: 'CCSS-ELA',
  supportingStandards: 'CCSS-ELA',
  mediaLiteracyStandards: 'MSLS',
  eldStandards: 'ELD',
};

/** Trims spaces, including the non-breaking spaces Google Sheets exports. */
export function clean(text: string | undefined): string {
  return (text ?? '').replace(/\u00a0/g, ' ').trim();
}

interface ListLines {
  /** Bulleted lines, bullet removed. */
  items: string[];
  /** Non-empty lines without a bullet, in a cell that also has bulleted lines. */
  others: string[];
}

/** Splits a cell into its bulleted lines and any other lines. */
function listLines(cell: string): ListLines {
  const lines = cell.split(/\r?\n/).map(clean).filter(Boolean);
  const bulleted = lines.filter((l) => BULLET.test(l));
  if (bulleted.length === 0) return { items: [], others: lines };
  return {
    items: bulleted.map((l) => clean(l.replace(BULLET, ''))).filter(Boolean),
    others: lines.filter((l) => !BULLET.test(l)),
  };
}

export interface ParsedStandards {
  refs: StandardRef[];
  issues: OutlineIssue[];
}

/**
 * Reads a comma-separated standards cell ("RL.6.1, 6.2 L.6.4", "SL.6.1.a–d")
 * into canonical references, raising Blocking issues for entries that are
 * malformed or do not exist.
 */
export function parseStandardsCell(
  cell: string,
  field: Exclude<StandardsField, 'eldStandards'>,
  lessonKey: string,
): ParsedStandards {
  const framework = FRAMEWORK_OF[field];
  const tokens = clean(cell)
    .replace(/\s*([–—])\s*/g, '$1')
    .split(/[,;\n]+|\s+/)
    .map(clean)
    .filter(Boolean);

  const refs: StandardRef[] = [];
  const issues: OutlineIssue[] = [];
  let lastStrand: string | undefined;

  const add = (code: string, raw: string) => {
    if (!refs.some((r) => r.code === code)) refs.push({ code, raw });
  };

  for (const token of tokens) {
    for (const raw of expandRange(token)) {
      const normalized = normalizeCode(raw, framework);
      if (!normalized.ok) {
        if (refs.some((r) => r.code === raw)) continue;
        const suggestion = suggestForBareNumber(raw, lastStrand, framework);
        issues.push({
          id: `${lessonKey}.${field}.${raw}`,
          severity: 'blocking',
          kind: 'malformed-standard',
          message: `"${raw}" is not a complete standard code (${normalized.reason}).`,
          lessonKey,
          field,
          raw,
          code: raw,
          ...(suggestion ? { suggestion } : {}),
        });
        add(raw, raw);
        continue;
      }
      const code = normalized.code;
      lastStrand = /^([A-Z]+)\./.exec(code)?.[1] ?? lastStrand;
      if (refs.some((r) => r.code === code)) continue;
      if (!hasStandard(code)) {
        const parent = code.split('.').slice(0, -1).join('.');
        issues.push({
          id: `${lessonKey}.${field}.${code}`,
          severity: 'blocking',
          kind: 'unknown-standard',
          message: `${code} is not a ${framework} standard.${hasStandard(parent) ? ` Did you mean ${parent}?` : ''}`,
          lessonKey,
          field,
          raw,
          code,
          ...(hasStandard(parent) ? { suggestion: parent } : {}),
        });
      }
      add(code, raw);
    }
  }
  return { refs, issues };
}

/** "W.6.3.a–e" → ["W.6.3.a", …, "W.6.3.e"]; anything else is returned unchanged. */
function expandRange(token: string): string[] {
  const match = /^(.*?)\.?([a-z])[–—-]([a-z])$/.exec(token);
  if (!match) return [token];
  const [, base, from, to] = match as unknown as [string, string, string, string];
  const start = from.charCodeAt(0);
  const end = to.charCodeAt(0);
  if (end < start || end - start > 10) return [token];
  return Array.from({ length: end - start + 1 }, (_, i) => `${base}.${String.fromCharCode(start + i)}`);
}

/** "6.2" after "RL.6.1" most likely means "RL.6.2". */
function suggestForBareNumber(
  raw: string,
  strand: string | undefined,
  framework: Framework,
): string | undefined {
  if (!strand || !/^\d+\.\d+(\.[a-z])?$/.test(raw)) return undefined;
  const candidate = normalizeCode(`${strand}.${raw}`, framework);
  return candidate.ok && hasStandard(candidate.code) ? candidate.code : undefined;
}

export interface ParsedEld {
  refs: EldStandardRef[];
  issues: OutlineIssue[];
  notes: string[];
}

/**
 * Reads ELD lines ("• ELD.PI.6.7 – Analyze author purpose") and warns when an
 * Outline description does not fit the code's official meaning.
 */
export function parseEldCell(cell: string, lessonKey: string): ParsedEld {
  const field = 'eldStandards';
  const { items, others } = listLines(cell);
  const lines = items.length > 0 ? items : others;
  const refs: EldStandardRef[] = [];
  const issues: OutlineIssue[] = [];
  const notes: string[] = items.length > 0 ? [...others] : [];

  for (const line of lines) {
    const match = new RegExp(`^(\\S+)\\s*${DASH.source}\\s*(.+)$`).exec(line);
    const normalized = match ? normalizeCode(match[1]!, 'ELD') : undefined;
    if (!match || !normalized?.ok) {
      notes.push(line);
      continue;
    }
    const code = normalized.code;
    const description = clean(match[2]);
    refs.push({ code, raw: line, description });

    if (!hasStandard(code)) {
      issues.push({
        id: `${lessonKey}.${field}.${code}`,
        severity: 'blocking',
        kind: 'unknown-standard',
        message: `${code} is not an ELD standard.`,
        lessonKey,
        field,
        raw: line,
        code,
      });
      continue;
    }
    const verdict = suggestEldCode(code, description);
    if (!verdict.matches) {
      const suggested = verdict.suggestion?.code;
      issues.push({
        id: `${lessonKey}.${field}.${code}.${slug(description)}`,
        severity: 'warning',
        kind: 'eld-description-mismatch',
        message:
          `The Outline describes ${code} as "${description}", but officially it is ` +
          `"${verdict.official?.text ?? code}".` +
          (suggested ? ` ${suggested} ("${verdict.suggestion!.text}") may be intended.` : ''),
        lessonKey,
        field,
        raw: line,
        code,
        ...(suggested ? { suggestion: suggested } : {}),
      });
    }
  }
  return { refs, issues, notes };
}

export interface ParsedVocabulary {
  words: VocabularyWord[];
  notes: string[];
}

const WORD_WITH_PAGE = /^(.+?)\s*\((\d+)\)$/;

/** Lines this long in a vocabulary cell are guidance, not a word or phrase. */
const NOTE_MIN_WORDS = 4;

/**
 * Reads a vocabulary cell: one word or short phrase per line (bulleted or not,
 * with an optional page number), or a comma-separated list. Sentence-length
 * lines are Designer Notes.
 */
export function parseVocabularyCell(cell: string): ParsedVocabulary {
  const { items, others } = listLines(cell);
  const lines = [...items, ...others];
  const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;
  const pieces = (line: string) => line.split(',').map(clean).filter(Boolean);
  // A comma list of short entries is vocabulary however long the line is.
  const isNote = (line: string) =>
    wordCount(line) >= NOTE_MIN_WORDS && pieces(line).some((p) => wordCount(p) >= NOTE_MIN_WORDS);
  const entries = lines.filter((line) => !isNote(line)).flatMap(pieces);

  const words = entries.map((entry): VocabularyWord => {
    const withPage = WORD_WITH_PAGE.exec(entry);
    return withPage ? { word: clean(withPage[1]), page: Number(withPage[2]) } : { word: entry };
  });
  return { words, notes: lines.filter(isNote) };
}

/** Bulleted lines of a cell, or its non-empty lines when it has no bullets. */
export function bulletItems(cell: string): string[] {
  const { items, others } = listLines(cell);
  return items.length > 0 ? items : others;
}

const PAGES = /\bpp?\.\s*(\d+)\s*[–—-]\s*(\d+)/;

export function parseFocusPages(description: string): PageRange | undefined {
  const match = PAGES.exec(description);
  return match ? { from: Number(match[1]), to: Number(match[2]) } : undefined;
}

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}
