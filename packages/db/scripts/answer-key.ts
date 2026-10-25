/**
 * Compares generated Lessons with the published Unit 4 Lessons (the Answer Key,
 * ADR 0007) for QUALITY.md. Evaluation only: nothing here feeds a prompt.
 *
 *   cd packages/db && npx tsx --env-file=../../.env scripts/answer-key.ts 1 4 45:L41
 *
 * Each argument is a published Lesson number, optionally with our Outline key
 * (published numbering counts Flex Days, so published Lesson 45 is our L41).
 * For each: title, Section minutes, standards, vocabulary and length, generated
 * beside published.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lessonToLines, sectionMinutes, type Lesson } from '@lcg/lesson-schema';
import { eq } from 'drizzle-orm';
import { connect } from '../src/client.js';
import { readLessonContent } from '../src/documents.js';
import { lessons } from '../src/schema.js';

interface RichNode {
  text?: string;
  content?: RichNode[];
}

interface PublishedLesson {
  title: string;
  type: string;
  total_time_in_minutes: number[];
  standard_lists: { title: string; standards: { code: string }[] }[];
  vocabulary_lists: { title: string; vocabulary: { word: string }[] }[];
  anchor_text_cards: { title: string }[];
  sections: { teacher: { title: string; estimated_time_in_minutes: number[]; body: RichNode | null }[] };
}

const here = dirname(fileURLToPath(import.meta.url));
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
const textOf = (node: RichNode | null | undefined): string =>
  node ? [node.text ?? '', ...(node.content ?? []).map(textOf)].join(' ') : '';

function published(lesson: number): PublishedLesson {
  const file = resolve(here, `../../../docs/source/example-lessons/u4_lesson${String(lesson).padStart(2, '0')}_data.json`);
  const data = JSON.parse(readFileSync(file, 'utf8')) as { queries: { state: { data: PublishedLesson | null } }[] };
  return data.queries.map((q) => q.state.data).find((d) => d?.sections)!;
}

function row(label: string, generated: string, answer: string) {
  return `| ${label} | ${generated} | ${answer} |`;
}

const { db, close } = connect();
for (const argument of process.argv.slice(2)) {
  const [publishedNumber, outlineKey] = argument.split(':');
  const number = Number(publishedNumber);
  const ourKey = outlineKey ?? `L${number}`;
  const key = published(number);
  const [stored] = await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.key, ourKey));
  const ours: Lesson | undefined = stored ? await readLessonContent(db, stored.id) : undefined;
  if (!ours) {
    console.log(`## Published Lesson ${number} / our ${ourKey}: not generated\n`);
    continue;
  }
  const standards = (title: RegExp) =>
    key.standard_lists.filter((l) => title.test(l.title)).flatMap((l) => l.standards.map((s) => s.code)).join(', ') || 'none';
  console.log(`## Published Lesson ${number} / our ${ourKey}\n`);
  console.log('| | Generated | Published (Answer Key) |\n|---|---|---|');
  console.log(row('Title', ours.title, key.title));
  console.log(row('Sections (minutes)', ours.sections.map((s) => `${s.title} ${sectionMinutes(s)}`).join(', '), key.sections.teacher.map((s) => `${s.title} ${s.estimated_time_in_minutes.join('-')}`).join(', ')));
  console.log(row('Focus Standards', ours.header.focusStandards.join(', '), standards(/focus/i)));
  console.log(row('ELD Standards', ours.header.eldStandards.join(', '), standards(/eld/i)));
  console.log(row('Vocabulary', ours.header.vocabulary.map((v) => v.word).join(', '), key.vocabulary_lists.flatMap((l) => l.vocabulary.map((v) => v.word)).join(', ') || 'none'));
  console.log(row('Texts', ours.header.texts.map((t) => t.title).join('; '), key.anchor_text_cards.map((t) => t.title).join('; ') || 'none'));
  console.log(row('Activities', String(ours.sections.flatMap((s) => s.activities).length), 'n/a'));
  console.log(row('Words (Teacher View)', String(words(lessonToLines(ours).join(' '))), String(words(key.sections.teacher.map((s) => textOf(s.body)).join(' ')))));
  console.log('');
}
await close();
