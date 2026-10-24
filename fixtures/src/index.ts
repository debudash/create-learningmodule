import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
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

/**
 * The few-shot example Lesson for a Lesson Type, as Markdown (the Teacher View of a published
 * Units 1–3 Lesson, built by packages/generation/scripts/build-examples.ts). Never Unit 4.
 */
export function exampleLessonMarkdown(lessonType: string): string {
  if (!/^[a-z-]+$/.test(lessonType)) throw new Error(`not a Lesson Type: ${lessonType}`);
  return read(`examples/${lessonType}.md`);
}

/** Which published Lesson each example came from, as unvalidated JSON. */
export function exampleManifest(): unknown {
  return JSON.parse(read('examples/manifest.json'));
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

const RECORDING_KEY = /^[a-z0-9-]+(\/[A-Za-z0-9-]+)*$/;

function recordingFile(key: string): string {
  if (!RECORDING_KEY.test(key)) throw new Error(`Not a recording key: ${key}`);
  return fileURLToPath(new URL(`../recordings/${key}.json`, import.meta.url));
}

/** A recorded model result saved by a live run, for replay mode; undefined if none was recorded. */
export function readRecording(key: string): unknown {
  const file = recordingFile(key);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined;
}

/** Saves a model result from a live run so replay mode can serve it later. */
export function writeRecording(key: string, value: unknown): void {
  const file = recordingFile(key);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
