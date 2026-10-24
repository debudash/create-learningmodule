/**
 * Builds the few-shot example Lessons, one per Lesson Type, from Newsela's published
 * Lessons in Units 1–3. Run with `pnpm --filter @lcg/generation build:examples`.
 *
 * Reads the extracted lesson objects in docs/source/example-lessons/unit{1,2,3}_all/ (see
 * STRUCTURE.md there) and writes:
 * - fixtures/examples/<lessonType>.md: the Lesson's Teacher View as compact Markdown;
 * - fixtures/examples/manifest.json: which published Lesson each example came from;
 * - packages/generation/data/example-sources.json: the same manifest, imported by
 *   src/examples.ts (a JSON file outside the package cannot be part of its tsc project).
 *
 * Published Unit 4 is the Answer Key (ADR 0007): it is held out, and asking this script for a
 * Unit 4 Lesson throws before anything is read.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LESSON_TYPES, type LessonType } from '@lcg/lesson-schema';

const here = dirname(fileURLToPath(import.meta.url));
const sourceDir = resolve(here, '../../../docs/source/example-lessons');
const outDir = resolve(here, '../../../fixtures/examples');
const sourcesFile = resolve(here, '../data/example-sources.json');
const textsFile = resolve(here, '../data/example-texts.json');
const SITE = 'https://ca-2026-review.newsela.com';

/** The only Units examples may come from (ADR 0007: Unit 4 is the Answer Key). */
const EXAMPLE_UNITS = [1, 2, 3] as const;

/** Rendered files longer than this are trimmed (repeated support panels first). */
const MAX_WORDS = 6000;

interface Choice {
  unit: number;
  lesson: number;
}

/**
 * The published Lesson used for each Lesson Type, from the suggestions in LESSON_TYPES.md.
 * - spark: U2 L2 over U2 L1 and U1 L3. All three have 2 ELD, 2 Additional Support panels and a
 *   Pulse Check; U2 L2 has the most sample responses (30 against 10 and 22) and a Homework.
 * - core-writing: U3 L12 is one of only three Units 1–3 Writing Lessons with a Pulse Check.
 * - writing: U3 L37 (Showcase); no Showcase Writing Lesson in Units 1–3 has a Pulse Check.
 * - flex-day: U3 L36; Flex Days check with per-huddle Quick Checks, not Pulse Checks.
 */
const CHOICES: Record<LessonType, Choice> = {
  spark: { unit: 2, lesson: 2 },
  'core-reading': { unit: 3, lesson: 4 },
  'core-writing': { unit: 3, lesson: 12 },
  'academic-discussion': { unit: 2, lesson: 18 },
  writing: { unit: 3, lesson: 37 },
  'flex-day': { unit: 3, lesson: 36 },
};

// ---------------------------------------------------------------------------------------------
// Source data

interface Mark {
  type: string;
  attrs?: { color?: string };
}

interface RichNode {
  type: string;
  text?: string;
  marks?: Mark[];
  attrs?: Record<string, unknown>;
  content?: RichNode[];
}

interface LessonObject {
  title: string;
  type: string;
  total_time_in_minutes: number[];
  standard_lists: { title: string; standards: { code: string; description: string }[] }[];
  objectives: { teacher: { title: string; body: RichNode }[] };
  essential_questions: RichNode | null;
  vocabulary_lists: { title: string; vocabulary: { word: string; definition: string }[] }[];
  anchor_text_cards: { label: string; title: string; author: string }[];
  breadcrumbs: { teacher: { label: string }[] };
  sections: {
    teacher: {
      title: string;
      purpose: RichNode | null;
      sequence: number;
      estimated_time_in_minutes: number[];
      body: RichNode | null;
    }[];
  };
}

interface Dehydrated<T> {
  queries: { state: { data: T } }[];
}

function assertExampleUnit(unit: number): void {
  if (!(EXAMPLE_UNITS as readonly number[]).includes(unit)) {
    throw new Error(
      `Unit ${unit} cannot be used for examples: only Units 1-3 may be (published Unit 4 is the Answer Key, ADR 0007)`,
    );
  }
}

/** The lesson object inside the dehydrated React-Query data of one extracted Lesson. */
function readLesson({ unit, lesson }: Choice): LessonObject {
  assertExampleUnit(unit);
  const file = resolve(sourceDir, `unit${unit}_all`, `u${unit}_lesson${pad(lesson)}_data.json`);
  const data = JSON.parse(readFileSync(file, 'utf8')) as Dehydrated<LessonObject | null>;
  const found = data.queries.map((q) => q.state.data).find((d) => d && d.sections);
  if (!found) throw new Error(`no lesson object in ${file}`);
  // The breadcrumbs name the Unit; check them so a misfiled source cannot slip through.
  const unitCrumb = found.breadcrumbs.teacher.find((b) => /^Unit \d+$/.test(b.label));
  if (unitCrumb?.label !== `Unit ${unit}`) {
    throw new Error(
      `${file} is not a Unit ${unit} Lesson (breadcrumb: ${unitCrumb?.label ?? 'none'})`,
    );
  }
  return found;
}

interface NavNode {
  label: string;
  url?: string;
  children?: NavNode[];
}

/** The published Teacher View URL of a Lesson, from the course tree in course_nav.json. */
function sourceUrl({ unit, lesson }: Choice): string {
  assertExampleUnit(unit);
  const nav = JSON.parse(
    readFileSync(resolve(sourceDir, 'course_nav.json'), 'utf8'),
  ) as Dehydrated<{
    data: NavNode[];
  }>;
  const unitNode = nav.queries[0]?.state.data.data.find((u) => u.label.startsWith(`Unit ${unit}:`));
  const lessonNode = unitNode?.children
    ?.flatMap((group) => group.children ?? [])
    .find((l) => l.label === `Lesson ${lesson}`);
  if (!lessonNode?.url)
    throw new Error(`no URL for Unit ${unit}, Lesson ${lesson} in course_nav.json`);
  return SITE + lessonNode.url;
}

// ---------------------------------------------------------------------------------------------
// Rich text (ProseMirror/TipTap JSON) to Markdown

// Scripted teacher speech is teal (#208095) on the page; it follows a Say/Ask label, so it is
// rendered as plain text. Sample student responses are purple.
const SAMPLE_RESPONSE = '#720780';
const CALLOUT_LABELS: Record<string, string> = {
  purpose: 'PURPOSE',
  say: 'SAY / ASK',
  watch: 'WATCH FOR',
};

/** How many panels of each repeated kind to keep; Infinity keeps all. */
interface Limits {
  panels: number;
}

interface RenderState {
  limits: Limits;
  seen: Map<string, number>;
  trimmed: boolean;
  /** False inside table headers, where purple text is a column title, not a response. */
  samples: boolean;
}

/** Icons and emoji are decoration on the page; they carry no instruction. */
const clean = (text: string) =>
  text.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\u00a0/g, ' ');

const hasMark = (node: RichNode, type: string) => (node.marks ?? []).some((m) => m.type === type);
const colorOf = (node: RichNode) => node.marks?.find((m) => m.type === 'textColor')?.attrs?.color;

function plainText(node: RichNode | null | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return clean(node.text ?? '');
  if (node.type === 'hard_break') return ' ';
  return (node.content ?? []).map(plainText).join(node.type === 'doc' ? ' ' : '');
}

/** Wraps text in a Markdown marker, keeping surrounding spaces outside it. */
function wrap(text: string, marker: string): string {
  const match = /^(\s*)(.*?)(\s*)$/s.exec(text);
  if (!match || !match[2]) return text;
  return `${match[1]}${marker}${match[2]}${marker}${match[3]}`;
}

/**
 * Teacher-move labels, normalised to Say / Ask / Teach / Directions. On the page the label's
 * bold often covers only part of it ("**Say these** Directions:"), so it is matched on the text.
 */
const MOVE_LABEL = /^\s*(Say these Directions|Directions|Say|Ask|Teach)\s*:\s*/i;
const moveName = (label: string) =>
  /directions/i.test(label) ? 'Directions' : label[0]!.toUpperCase() + label.slice(1).toLowerCase();

/**
 * Purple paragraphs that open with a short step label ("Identify the Root: ...") are teacher
 * steps coloured by mistake on the page, not sample responses.
 */
const STEP_LABEL = /^[A-Z][A-Za-z]*(?: [A-Za-z]+){0,3}: /;

/** Drops the first `count` characters of a run of inline nodes. */
function dropChars(nodes: RichNode[], count: number): RichNode[] {
  let left = count;
  const out: RichNode[] = [];
  for (const node of nodes) {
    const text = clean(node.text ?? '');
    if (left >= text.length) {
      left -= text.length;
      continue;
    }
    out.push({ ...node, text: text.slice(left) });
    left = 0;
  }
  return out;
}

interface InlineOptions {
  strong: boolean;
  em: boolean;
  /** Label purple runs "Sample response:" (off in table headers and labelled paragraphs). */
  samples: boolean;
}

/** Inline content: runs with the same marks are merged so the Markdown stays readable. */
function inline(nodes: RichNode[], options: InlineOptions): string {
  const runs: { text: string; strong: boolean; em: boolean; sample: boolean }[] = [];
  for (const node of nodes) {
    const text = node.type === 'hard_break' ? ' ' : clean(node.text ?? '');
    if (!text) continue;
    const strong = options.strong && hasMark(node, 'strong');
    const em = options.em && hasMark(node, 'em');
    const sample = options.samples && colorOf(node) === SAMPLE_RESPONSE && !!text.trim();
    const last = runs.at(-1);
    if (
      last &&
      last.strong === strong &&
      last.em === em &&
      (last.sample === sample || !text.trim())
    ) {
      last.text += text;
    } else {
      runs.push({ text, strong, em, sample });
    }
  }
  return runs
    .map((r, i) => {
      let text = r.text;
      if (r.em) text = wrap(text, '*');
      if (r.strong) text = wrap(text, '**');
      if (r.sample && !runs[i - 1]?.sample) text = ` Sample response: ${text.trimStart()}`;
      return text;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A paragraph. Teacher moves get a bold label, sample responses (purple on the page) are
 * labelled "Sample response:", and teacher notes (all italic) stay italic.
 */
function paragraph(node: RichNode, state: RenderState): string {
  const content = node.content ?? [];
  const texts = content.filter((n) => n.type === 'text' && clean(n.text ?? '').trim());
  if (texts.length === 0) return '';
  const text = plainText(node);
  const allSample = texts.every((n) => colorOf(n) === SAMPLE_RESPONSE);
  const allStrong = texts.every((n) => hasMark(n, 'strong'));
  const move = MOVE_LABEL.exec(text);
  if (move && !(allSample && !allStrong)) {
    const rest = inline(dropChars(content, move[0].length), {
      strong: true,
      em: true,
      samples: state.samples,
    });
    return `**${moveName(move[1]!)}:** ${rest}`.trim();
  }
  if (allSample && state.samples && !allStrong && !STEP_LABEL.test(text.trim())) {
    return `Sample response: ${inline(content, { strong: false, em: true, samples: false })}`;
  }
  if (allSample && allStrong) return `**${text.trim()}**`;
  if (texts.every((n) => hasMark(n, 'em') && !hasMark(n, 'strong'))) {
    return wrap(inline(content, { strong: false, em: false, samples: false }), '*');
  }
  return inline(content, { strong: true, em: true, samples: state.samples && !allSample });
}

const indent = (text: string, by: string) =>
  text
    .split('\n')
    .map((line) => (line ? by + line : line))
    .join('\n');

function list(node: RichNode, state: RenderState, ordered: boolean): string {
  const letters = node.attrs?.type === 'A';
  return (node.content ?? [])
    .map((item, i) => {
      const bullet = ordered ? (letters ? `${String.fromCharCode(65 + i)}.` : `${i + 1}.`) : '-';
      const body = blocks(item.content ?? [], state, '\n');
      if (!body) return '';
      const [first = '', ...rest] = body.split('\n');
      const pad = ' '.repeat(bullet.length + 1);
      return [`${bullet} ${first}`, ...rest.map((line) => (line ? pad + line : line))].join('\n');
    })
    .filter(Boolean)
    .join('\n');
}

/** A table cell's blocks; header cells never label sample responses. */
function cellBlocks(node: RichNode, state: RenderState): string {
  const header = node.type === 'table_header';
  const saved = state.samples;
  if (header) state.samples = false;
  const out = blocks(node.content ?? [], state, '\n');
  state.samples = saved;
  return out;
}

/** A table cell flattened to one line: paragraphs joined with <br>, list items with bullets. */
function cell(node: RichNode, state: RenderState): string {
  return cellBlocks(node, state)
    .split('\n')
    .map((line) => line.trim().replace(/^- /, '• '))
    .filter(Boolean)
    .join('<br>')
    .replace(/\|/g, '\\|');
}

const quote = (text: string) => indent(text, '> ').replace(/^> $/gm, '>');

function table(node: RichNode, state: RenderState): string {
  const rowNodes = node.content ?? [];
  // One-column tables are boxed items on the page (Teacher Tip, Pulse Check, Reflection): the
  // first cell is the box's title, the rest is quoted with its lists and line breaks intact.
  if (rowNodes.every((r) => (r.content ?? []).length === 1)) {
    const [head = '', ...body] = rowNodes
      .map((r) => cellBlocks(r.content![0]!, state))
      .filter((c) => c.trim());
    const title = head.startsWith('#') ? head : `**${head.replace(/\*\*/g, '')}**`;
    return body.length > 0 ? `${title}\n\n${quote(body.join('\n\n'))}` : title;
  }
  const filled = rowNodes
    .map((row) => (row.content ?? []).map((c) => cell(c, state)))
    .filter((r) => r.some(Boolean));
  if (filled.length === 0) return '';
  const width = Math.max(...filled.map((r) => r.length));
  const row = (r: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => r[i] ?? '').join(' | ')} |`;
  const [head = [], ...body] = filled;
  return [row(head), `|${' --- |'.repeat(width)}`, ...body.map(row)].join('\n');
}

/** A collapsible panel, cut once the Lesson already showed `limits.panels` of the same kind. */
function collapsible(node: RichNode, state: RenderState): string {
  const label = clean(String(node.attrs?.label ?? '')).trim();
  const kind = label.split(':')[0] ?? label;
  const count = (state.seen.get(kind) ?? 0) + 1;
  state.seen.set(kind, count);
  if (count > state.limits.panels) {
    state.trimmed = true;
    return `**${label}** *(trimmed)*`;
  }
  return `**${label}**\n\n${blocks(node.content ?? [], state, '\n\n')}`;
}

function callout(node: RichNode, state: RenderState): string {
  const variant = String(node.attrs?.variant ?? '');
  const label = CALLOUT_LABELS[variant];
  const content = [...(node.content ?? [])];
  // Callouts open with their own decorated title ("PURPOSE", "SAY / ASK:"); the label replaces it.
  const firstText = plainText(content[0])
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
  if (label && firstText && label.replace(/[^A-Z]/g, '').startsWith(firstText.slice(0, 5)))
    content.shift();
  const body = blocks(content, state, '\n');
  return quote(label ? `**${label}:**\n${body}` : body);
}

function block(node: RichNode, state: RenderState): string {
  switch (node.type) {
    case 'paragraph':
      return paragraph(node, state);
    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level ?? 3), 3), 6);
      const text = plainText(node)
        .trim()
        .replace(MOVE_LABEL, (_, label: string) => `${moveName(label)}: `)
        .trim();
      return text ? `${'#'.repeat(level)} ${text}` : '';
    }
    case 'routine_heading': {
      const text = plainText(node).trim();
      return text ? `#### Routine: ${text}` : '';
    }
    case 'bullet_list':
      return list(node, state, false);
    case 'ordered_list':
      return list(node, state, true);
    case 'table':
      return table(node, state);
    case 'collapsible':
      return collapsible(node, state);
    case 'callout':
      return callout(node, state);
    case 'doc':
      return blocks(node.content ?? [], state, '\n\n');
    case 'horizontal_rule':
      return '';
    default:
      throw new Error(`unknown rich-text node "${node.type}"; add it to build-examples.ts`);
  }
}

function blocks(nodes: RichNode[], state: RenderState, separator: string): string {
  return nodes
    .map((n) => block(n, state))
    .filter((s) => s.trim())
    .join(separator);
}

// ---------------------------------------------------------------------------------------------
// The Lesson's Teacher View

const minutes = (range: number[]) => {
  const [min = 0, max = min] = range;
  return min === max ? `${min} min` : `${min}-${max} min`;
};

function header(lesson: LessonObject, lessonType: LessonType): string[] {
  const out = [
    `# ${clean(lesson.title)}`,
    '',
    `**Lesson Type:** ${lesson.type} (\`${lessonType}\`) · ${minutes(lesson.total_time_in_minutes)}`,
  ];
  const standardLists: [string, string][] = [
    ['Focus Standards', 'Focus Standards'],
    ['Supporting Standards', 'Supporting Standards'],
    ['ELD Standards', 'ELD Standards'],
  ];
  for (const [match, heading] of standardLists) {
    const list = lesson.standard_lists.find((l) => l.title.includes(match));
    if (!list || list.standards.length === 0) continue;
    out.push(
      '',
      `## ${heading}`,
      ...list.standards.map((s) => `- **${s.code}**: ${clean(s.description).trim()}`),
    );
  }
  out.push('', '## Objectives');
  for (const objective of lesson.objectives.teacher) {
    out.push(`- **${objective.title}:** ${plainText(objective.body).replace(/\s+/g, ' ').trim()}`);
  }
  // Some Lessons run two questions together in one paragraph ("...difficult?How does...").
  const questions = (lesson.essential_questions?.content ?? [])
    .flatMap((n) => plainText(n).split(/(?<=\?)\s*(?=[A-Z])/))
    .map((q) => q.trim())
    .filter(Boolean);
  if (questions.length > 0)
    out.push('', '## Essential Questions', ...questions.map((q) => `- ${q}`));
  const texts = lesson.anchor_text_cards.map(
    (t) => `- ${t.label}: *${clean(t.title)}*${t.author ? ` by ${t.author}` : ''}`,
  );
  if (texts.length > 0) out.push('', '## Lesson Texts', ...texts);
  const vocabulary = lesson.vocabulary_lists.filter((l) => l.vocabulary.length > 0);
  if (vocabulary.length > 0) {
    out.push('', '## Vocabulary');
    for (const l of vocabulary) {
      out.push(
        `- ${l.title}: ${l.vocabulary.map((v) => `**${v.word}** (${clean(v.definition)})`).join('; ')}`,
      );
    }
  }
  return out;
}

function render(
  lesson: LessonObject,
  lessonType: LessonType,
  limits: Limits,
): { markdown: string; trimmed: boolean } {
  const state: RenderState = { limits, seen: new Map(), trimmed: false, samples: true };
  const out = header(lesson, lessonType);
  const sections = [...lesson.sections.teacher].sort((a, b) => a.sequence - b.sequence);
  sections.forEach((section, i) => {
    const time = section.estimated_time_in_minutes.some((m) => m > 0)
      ? ` (${minutes(section.estimated_time_in_minutes)})`
      : '';
    out.push('', `## Section ${i + 1}: ${clean(section.title)}${time}`);
    const purpose = section.purpose ? block(section.purpose, state) : '';
    if (purpose) out.push('', `**Purpose:**`, '', purpose);
    const body = section.body ? block(section.body, state) : '';
    if (body) out.push('', body);
  });
  const markdown = `${out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`;
  return { markdown, trimmed: state.trimmed };
}

const wordCount = (text: string) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** Renders the whole Lesson; over MAX_WORDS, repeated panels are cut down until it fits. */
function renderWithinBudget(
  lesson: LessonObject,
  lessonType: LessonType,
): { markdown: string; words: number } {
  for (const panels of [Infinity, 2, 1]) {
    const { markdown, trimmed } = render(lesson, lessonType, { panels });
    const words = wordCount(markdown);
    if (words <= MAX_WORDS || panels === 1) {
      const note = trimmed
        ? '\n> *(trimmed)*: repeated support panels were cut to keep this example short.\n'
        : '';
      return { markdown: note ? markdown.replace('\n\n## ', `\n${note}\n## `) : markdown, words };
    }
  }
  throw new Error('unreachable');
}

// ---------------------------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

interface ManifestEntry {
  unit: number;
  lesson: number;
  title: string;
  sourceUrl: string;
  file: string;
}

function main(): void {
  mkdirSync(outDir, { recursive: true });
  mkdirSync(dirname(sourcesFile), { recursive: true });
  const manifest: Partial<Record<LessonType, ManifestEntry>> = {};
  const texts: Partial<Record<LessonType, string>> = {};
  for (const lessonType of LESSON_TYPES) {
    const choice = CHOICES[lessonType];
    const lesson = readLesson(choice);
    const { markdown, words } = renderWithinBudget(lesson, lessonType);
    const file = `${lessonType}.md`;
    writeFileSync(resolve(outDir, file), markdown);
    texts[lessonType] = markdown;
    manifest[lessonType] = {
      ...choice,
      title: clean(lesson.title),
      sourceUrl: sourceUrl(choice),
      file,
    };
    console.log(`${file}: Unit ${choice.unit}, ${lesson.title} (${words} words)`);
  }
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  writeFileSync(resolve(outDir, 'manifest.json'), json);
  writeFileSync(sourcesFile, json);
  writeFileSync(textsFile, `${JSON.stringify(texts, null, 2)}
`);
}

main();
