import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SAMPLE_PATH = fileURLToPath(
  new URL('../../../fixtures/outlines/g6-u4-lightning-thief.csv', import.meta.url),
);

/** The sample Unit 4 Outline (The Lightning Thief), as exported from Google Sheets. */
export function sampleOutlineCsv(): string {
  return readFileSync(SAMPLE_PATH, 'utf8');
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
