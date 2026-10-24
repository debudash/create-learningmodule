import type { LessonType } from '@lcg/lesson-schema';
import {
  bulletItems,
  clean,
  parseEldCell,
  parseFocusPages,
  parseStandardsCell,
  parseVocabularyCell,
  slug,
} from './cells.js';
import { parseCsv } from './csv.js';
import type {
  ImportProposal,
  OutlineArc,
  OutlineIssue,
  OutlineLesson,
  OutlineUnit,
} from './types.js';

/** The Outline columns the parser understands, matched by header text. */
const COLUMNS = {
  filename: (h: string) => h === 'filename',
  arc: (h: string) => h === 'lesson',
  lessonNumber: (h: string) => h === 'lesson #',
  type: (h: string) => h === 'type of lesson',
  days: (h: string) => h === 'days',
  question: (h: string) => h.startsWith('text dependent question'),
  description: (h: string) => h === 'lesson description',
  textSet: (h: string) => h.startsWith('text set'),
  homework: (h: string) => h === 'homework',
  focus: (h: string) => h.startsWith('focus standards'),
  supporting: (h: string) => h.startsWith('additional supported'),
  mediaLiteracy: (h: string) => h.includes('media literacy'),
  performanceTaskSkill: (h: string) => h.startsWith('skill or content'),
  foundationalSkills: (h: string) => h.startsWith('foundational skills'),
  vocabulary: (h: string) => h === 'vocabulary',
  eld: (h: string) => h.includes('eld standards'),
} as const;

type Column = keyof typeof COLUMNS;
const REQUIRED: Column[] = ['arc', 'lessonNumber', 'type', 'description', 'focus'];

const normalizeHeader = (h: string) => clean(h).toLowerCase().replace(/\s+/g, ' ');

/** Parses a Unit Outline exported as CSV. */
export function parseOutlineCsv(csv: string): ImportProposal {
  return parseOutlineRows(parseCsv(csv));
}

/** Parses a Unit Outline given as rows of cells (from CSV or a spreadsheet file). */
export function parseOutlineRows(rows: string[][]): ImportProposal {
  const issues: OutlineIssue[] = [];
  const headerIndex = rows.findIndex((r) => r.some((c) => normalizeHeader(c) === 'lesson #'));
  const headers = headerIndex >= 0 ? rows[headerIndex]!.map((h) => clean(h)) : [];
  const columnIndex = mapColumns(headers);

  const missing = REQUIRED.filter((c) => columnIndex[c] === undefined);
  if (missing.length > 0) {
    issues.push({
      id: 'outline.columns',
      severity: 'blocking',
      kind: 'missing-column',
      message: `The Outline has no ${missing.join(', ')} column${missing.length > 1 ? 's' : ''}; is this a Unit Outline?`,
    });
  }

  const titleCell = rows.slice(0, Math.max(headerIndex, 0)).flat().map(clean).find(Boolean) ?? '';
  const unit = parseTitle(titleCell);

  const cell = (row: string[], column: Column) => {
    const index = columnIndex[column];
    return index === undefined ? '' : (row[index] ?? '');
  };

  const arcs: OutlineArc[] = [];
  const lessons: OutlineLesson[] = [];
  let currentArc: OutlineArc | undefined;
  let statedDayTotal: number | undefined;
  let flexCount = 0;

  const arcNamed = (name: string) => arcs.find((a) => a.name.toLowerCase() === name.toLowerCase());
  const addArc = (name: string): OutlineArc => {
    const arc: OutlineArc = { key: slug(name), name, position: arcs.length + 1, description: '' };
    arcs.push(arc);
    return arc;
  };

  for (const row of missing.length > 0 ? [] : rows.slice(headerIndex + 1)) {
    if (row.every((c) => !clean(c))) continue;
    const arcCell = clean(cell(row, 'arc'));
    const numberCell = clean(cell(row, 'lessonNumber'));
    const typeCell = clean(cell(row, 'type'));
    const lessonNumber = /^lesson\s*(\d+)$/i.exec(numberCell)?.[1];

    if (lessonNumber || /flex/i.test(typeCell)) {
      const isFlex = !lessonNumber;
      let arc = isFlex ? currentArc : (arcNamed(arcCell) ?? currentArc);
      if (!arc) arc = addArc(arcCell || 'Unit');
      const key = isFlex ? `F${++flexCount}` : `L${lessonNumber}`;
      if (!isFlex && arcCell && arc.name.toLowerCase() !== arcCell.toLowerCase()) {
        issues.push({
          id: `${key}.arc`,
          severity: 'warning',
          kind: 'arc-mismatch',
          message: `${key} names Arc "${arcCell}" but appears under "${arc.name}".`,
          lessonKey: key,
          raw: arcCell,
        });
      }
      currentArc = arc;
      lessons.push(readLesson(row, headers, cell, key, lessons.length + 1, arc, lessonNumber, issues));
      continue;
    }

    const flexHeader = /^end of (.+?)\s*\(flex days?\)$/i.exec(arcCell);
    if (flexHeader) {
      const arc = arcNamed(flexHeader[1]!) ?? currentArc;
      if (arc) {
        const text = clean(cell(row, 'description'));
        if (text) arc.flexDescription = text;
        currentArc = arc;
      }
      continue;
    }

    if (arcCell) {
      const arc = arcNamed(arcCell) ?? addArc(arcCell);
      arc.description = [cell(row, 'description'), numberCell].map(clean).filter(Boolean).join('\n');
      const skills = clean(cell(row, 'performanceTaskSkill'));
      if (skills) arc.performanceTaskSkills = skills;
      currentArc = arc;
      continue;
    }

    const days = clean(cell(row, 'days'));
    const others = row.filter((_, i) => i !== columnIndex.days).map(clean).filter(Boolean);
    if (/^\d+$/.test(days) && others.length === 0) statedDayTotal = Number(days);
  }

  const performanceTask = lessons
    .map((l) => /Performance Task\s*[—–-]\s*([^\n]+)/.exec(l.description)?.[1])
    .find(Boolean);
  if (performanceTask) unit.performanceTask = clean(performanceTask);

  issues.push(...checkUnitConsistency(unit, lessons, statedDayTotal, titleCell));

  return {
    unit,
    arcs,
    lessons,
    issues,
    ...(statedDayTotal !== undefined ? { statedDayTotal } : {}),
  };
}

function mapColumns(headers: string[]): Partial<Record<Column, number>> {
  const result: Partial<Record<Column, number>> = {};
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    for (const [column, matches] of Object.entries(COLUMNS) as [Column, (h: string) => boolean][]) {
      if (result[column] === undefined && matches(normalized)) {
        result[column] = index;
        break;
      }
    }
  });
  return result;
}

const TITLE = /^G(\d+),\s*U(\d+):\s*(.+?)\s+by\s+(.+)$/im;

function parseTitle(titleCell: string): OutlineUnit {
  const match = TITLE.exec(titleCell);
  const isbn = /ISBN\s*([\d-]{10,17})/i.exec(titleCell)?.[1]?.replace(/-/g, '');
  const anchorTitle = clean(match?.[3]) || 'Untitled';
  return {
    title: anchorTitle,
    grade: Number(match?.[1] ?? 0),
    unitNumber: Number(match?.[2] ?? 0),
    anchorText: {
      title: anchorTitle,
      author: clean(match?.[4]),
      ...(isbn ? { isbn } : {}),
    },
  };
}

function lessonTypeOf(outlineType: string, isFlex: boolean): LessonType | undefined {
  const t = outlineType.toLowerCase();
  if (isFlex || t.includes('flex')) return 'flex-day';
  if (t.startsWith('spark')) return 'spark';
  if (t.includes('core reading')) return 'core-reading';
  if (t.includes('core writing')) return 'core-writing';
  if (t.includes('academic discussion')) return 'academic-discussion';
  if (t.startsWith('writing')) return 'writing';
  return undefined;
}

function readLesson(
  row: string[],
  headers: string[],
  cell: (row: string[], column: Column) => string,
  key: string,
  position: number,
  arc: OutlineArc,
  lessonNumber: string | undefined,
  issues: OutlineIssue[],
): OutlineLesson {
  const outlineType = clean(cell(row, 'type'));
  const isFlex = key.startsWith('F');
  let lessonType = lessonTypeOf(outlineType, isFlex);
  if (!lessonType) {
    issues.push({
      id: `${key}.lessonType`,
      severity: 'blocking',
      kind: 'unknown-lesson-type',
      message: `${key} has an unrecognised Lesson Type "${outlineType}".`,
      lessonKey: key,
      raw: outlineType,
    });
    lessonType = 'core-reading';
  }

  const description = clean(cell(row, 'description'));
  const questionCell = clean(cell(row, 'question'));
  const goalsCell = /^learning goals/i.test(questionCell);
  const firstLine = description.split('\n')[0] ?? '';
  const heading = firstLine && !/^[•◦]/.test(firstLine) && firstLine.length <= 80 ? clean(firstLine) : undefined;

  const focus = parseStandardsCell(cell(row, 'focus'), 'focusStandards', key);
  const supporting = parseStandardsCell(cell(row, 'supporting'), 'supportingStandards', key);
  const media = parseStandardsCell(cell(row, 'mediaLiteracy'), 'mediaLiteracyStandards', key);
  const eld = parseEldCell(cell(row, 'eld'), key);
  const vocabulary = parseVocabularyCell(cell(row, 'vocabulary'));
  issues.push(...focus.issues, ...supporting.issues, ...media.issues, ...eld.issues);

  const filename = clean(cell(row, 'filename'));
  if (filename && lessonNumber && !filenameMatches(filename, Number(lessonNumber))) {
    issues.push({
      id: `${key}.filename`,
      severity: 'warning',
      kind: 'filename-mismatch',
      message: `${key}'s filename "${filename}" does not match its Lesson number.`,
      lessonKey: key,
      raw: filename,
    });
  }

  const focusPages = parseFocusPages(description);
  const rawCells = Object.fromEntries(
    headers.map((header, i) => [header, row[i] ?? ''] as const).filter(([header]) => header),
  );

  return {
    key,
    kind: isFlex ? 'flex-day' : 'lesson',
    position,
    ...(lessonNumber ? { lessonNumber: Number(lessonNumber) } : {}),
    arcKey: arc.key,
    lessonType,
    outlineType,
    isDoubleLesson: /double/i.test(outlineType),
    ...(filename ? { filename } : {}),
    ...(heading ? { heading } : {}),
    ...(questionCell && !goalsCell && !/^n\/?a$/i.test(questionCell)
      ? { textDependentQuestion: questionCell }
      : {}),
    learningGoals: goalsCell ? bulletItems(questionCell.replace(/^learning goals[^\n]*\n?/i, '')) : [],
    description,
    textSet: clean(cell(row, 'textSet')),
    homework: clean(cell(row, 'homework')),
    ...(focusPages ? { focusPages } : {}),
    focusStandards: focus.refs,
    supportingStandards: supporting.refs,
    mediaLiteracyStandards: media.refs,
    eldStandards: eld.refs,
    performanceTaskSkill: clean(cell(row, 'performanceTaskSkill')),
    foundationalSkills: clean(cell(row, 'foundationalSkills')),
    vocabulary: vocabulary.words,
    designerNotes: [...vocabulary.notes, ...eld.notes],
    rawCells,
  };
}

/** A filename like "L4_ELA_TE_G6_U3_CA_Core" must name exactly its own Lesson number. */
function filenameMatches(filename: string, lessonNumber: number): boolean {
  const numbers = [...filename.matchAll(/L(\d+)_/g)].map((m) => Number(m[1]));
  return numbers.length === 1 && numbers[0] === lessonNumber;
}

function checkUnitConsistency(
  unit: OutlineUnit,
  lessons: OutlineLesson[],
  statedDayTotal: number | undefined,
  titleCell: string,
): OutlineIssue[] {
  const issues: OutlineIssue[] = [];
  if (!TITLE.test(titleCell)) {
    issues.push({
      id: 'unit.title',
      severity: 'warning',
      kind: 'metadata-conflict',
      message: 'The Outline title row was not recognised; enter the grade, unit and anchor text by hand.',
      raw: titleCell,
    });
  }

  const fromFilenames = new Set(
    lessons
      .map((l) => /_G(\d+)_U(\d+)_/.exec(l.filename ?? ''))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => `G${m[1]} U${m[2]}`),
  );
  const fromTitle = `G${unit.grade} U${unit.unitNumber}`;
  const conflicting = [...fromFilenames].filter((v) => v !== fromTitle);
  if (unit.grade && conflicting.length > 0) {
    issues.push({
      id: 'unit.filenames',
      severity: 'warning',
      kind: 'metadata-conflict',
      message: `The title says ${fromTitle.replace(' ', ', ')}, but Lesson filenames say ${conflicting
        .map((v) => v.replace(' ', ', '))
        .join(' and ')}. The title is used.`,
      raw: conflicting.join(', '),
    });
  }

  if (statedDayTotal !== undefined && statedDayTotal !== lessons.length) {
    issues.push({
      id: 'unit.days',
      severity: 'warning',
      kind: 'day-total-mismatch',
      message: `The Outline totals ${statedDayTotal} days, but ${lessons.length} Lessons and Flex Days were found.`,
    });
  }
  return issues;
}
