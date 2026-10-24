import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Sample data for tests and the demo seed. This package is the only place that
 * reads fixture files, so the pure packages stay free of I/O.
 */

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

/** The sample Unit 4 Outline (The Lightning Thief), as exported from Google Sheets. */
export function sampleOutlineCsv(): string {
  return read('outlines/g6-u4-lightning-thief.csv');
}

/**
 * A hand-written Spark Lesson for Unit 4, Lesson 3, as unvalidated Lesson JSON.
 * Written for this project from the Outline row; it is not Newsela's published
 * Lesson (the Answer Key, ADR 0007) and must never be used as a few-shot example.
 */
export function sampleLessonJson(): unknown {
  return JSON.parse(read('lessons/g6-u4-l03-spark.json'));
}

const HEADERS = [
  'Filename', 'Lesson', 'Lesson #', 'Type of Lesson', 'Days', 'Text Dependent Question tied to the EQ',
  'Lesson Description', 'Text Set Choice', 'Homework', 'Focus Standards (assessed)',
  'Additional Supported CA ELA Standards', 'CA Media Literacy Standards',
  'Skill or content that will be needed for Performance Task', 'Foundational Skills Focus',
  'Vocabulary', 'Designated ELD Standards',
];

/** A one-Lesson Outline with the sample's columns, for cases the sample does not contain. */
export function miniOutlineCsv(lesson: Partial<Record<'type' | 'eld' | 'supporting', string>> = {}): string {
  const row = [
    'L1_ELA_TE_G6_U4_CA_Core', 'Spark', 'Lesson 1', lesson.type ?? 'Spark 1', '1', 'N/A',
    'Opening', '', '', 'RL.6.1', lesson.supporting ?? '', '', '', '', '', lesson.eld ?? '',
  ];
  const csv = (cells: string[]) => cells.map((c) => `"${c.replace(/"/g, '""')}"`).join(',');
  return [csv(['G6, U4: The Lightning Thief by Rick Riordan']), csv(HEADERS), csv(['', 'Spark']), csv(row)].join(
    '\n',
  );
}
