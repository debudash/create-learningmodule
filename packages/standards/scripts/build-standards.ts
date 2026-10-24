/**
 * Builds data/standards.grade6.json from the Common Standards Project (CSP) exports in
 * docs/source/standards/. Run with `pnpm --filter @lcg/standards build:data`.
 *
 * Codes are built from the CSP hierarchy (parentId / listId / position), not copied from
 * statementNotation, because CSP mis-codes some ELD items. Every deviation from the CSP data
 * is listed in CORRECTIONS and recorded in the output's attribution block. The CDE PDFs next to
 * the CSP files are the authority the corrections were checked against.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Framework, ProficiencyLevels, Standard } from '../src/types.js';

const GRADE = 6;
const here = dirname(fileURLToPath(import.meta.url));
const sourceDir = resolve(here, '../../../docs/source/standards');
const outFile = resolve(here, '../data/standards.grade6.json');

interface CspStandard {
  id: string;
  position: number;
  depth: number;
  parentId?: string;
  listId?: string;
  statementNotation?: string;
  description: string;
}

interface CspDocument {
  license: { title: string; URL: string; rightsHolder: string };
  document: { id: string; title: string; asnIdentifier: string; sourceURL: string };
  standards: Record<string, CspStandard> | CspStandard[];
}

interface Source {
  framework: Framework;
  file: string;
}

const SOURCES: Source[] = [
  { framework: 'CCSS-ELA', file: 'csp_CA_D2515047_grade-06.json' },
  { framework: 'ELD', file: 'csp_CA_D2659716_grade-06.json' },
  { framework: 'MSLS', file: 'csp_CA_D2622356_grade-06.json' },
];

/** Corrections applied to the CSP data, recorded in the dataset's attribution block. */
const CORRECTIONS: string[] = [
  'ELD Part II item 2 ("Understanding cohesion") is coded ELD.PII.6.1a/1b in CSP; built as ELD.PII.6.2.a/b from the CSP hierarchy, matching the CDE PDF.',
  'ELD item titles use the short Grade 6 chart titles from the CDE PDF (e.g. "Reading/viewing closely"); CSP carries the longer Part I overview wording.',
  'ELD.PII.6.7 Expanding: stray ")" before "→" removed, matching the CDE PDF.',
  'ELD.PI.6.11.b Bridging: missing final period restored, matching the CDE PDF.',
  'CCSS ELA: grade bands written "6—8" (em dash) in CSP restored to "6–8" (en dash), matching the CDE PDF.',
  'All text: whitespace normalised.',
];

/**
 * CSP statementNotation values known to disagree with the hierarchy. Any other disagreement
 * stops the build so a refreshed CSP export cannot silently change codes.
 */
const KNOWN_ELD_MISCODES: Record<string, string> = {
  // Part II item 2 sub-items a/b, coded as if they belonged to item 1.
  'PII.1a': 'PII.2a',
  'PII.1b': 'PII.2b',
};

/** Short ELD item titles from the CDE PDF's Grade 6 chart, keyed by part and item number. */
const ELD_TITLES: Record<string, string> = {
  'PI.1': 'Exchanging information/ideas',
  'PI.2': 'Interacting via written English',
  'PI.3': 'Supporting opinions and persuading others',
  'PI.4': 'Adapting language choices',
  'PI.5': 'Listening actively',
  'PI.6': 'Reading/viewing closely',
  'PI.7': 'Evaluating language choices',
  'PI.8': 'Analyzing language choices',
  'PI.9': 'Presenting',
  'PI.10': 'Writing',
  'PI.11': 'Justifying/arguing',
  'PI.12': 'Selecting language resources',
  'PII.1': 'Understanding text structure',
  'PII.2': 'Understanding cohesion',
  'PII.3': 'Using verbs and verb phrases',
  'PII.4': 'Using nouns and noun phrases',
  'PII.5': 'Modifying to add details',
  'PII.6': 'Connecting ideas',
  'PII.7': 'Condensing ideas',
};

/** Targeted text fixes, keyed by canonical code (and level for ELD). */
const TEXT_FIXES: Record<string, [string, string]> = {
  'ELD.PII.6.7:expanding': ['insecticides) →', 'insecticides →'],
  'ELD.PI.6.11.b:bridging': ['In my opinion…)', 'In my opinion…).'],
};

function fail(message: string): never {
  throw new Error(`build-standards: ${message}`);
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const usedFixes = new Set<string>();
function applyFix(key: string, text: string): string {
  const fix = TEXT_FIXES[key];
  if (!fix) return text;
  if (!text.includes(fix[0])) fail(`text fix for ${key} no longer applies`);
  usedFixes.add(key);
  return text.replace(fix[0], fix[1]);
}

function loadSource(file: string): { doc: CspDocument; nodes: CspStandard[] } {
  const doc = (JSON.parse(readFileSync(resolve(sourceDir, file), 'utf8')) as { data: CspDocument })
    .data;
  const nodes = (Array.isArray(doc.standards) ? doc.standards : Object.values(doc.standards))
    .slice()
    .sort((a, b) => a.position - b.position);
  return { doc, nodes };
}

function makeStandard(
  code: string,
  framework: Framework,
  text: string,
  parent?: string,
  levels?: ProficiencyLevels,
): Standard {
  // Key order here is the key order in the JSON file.
  return {
    code,
    framework,
    grade: GRADE,
    text,
    ...(levels ? { levels } : {}),
    ...(parent ? { parent } : {}),
    children: [],
  };
}

function linkChildren(standards: Standard[]): void {
  const byCode = new Map(standards.map((s) => [s.code, s]));
  for (const s of standards) {
    if (!s.parent) continue;
    const parent = byCode.get(s.parent) ?? fail(`${s.code}: parent ${s.parent} missing`);
    parent.children.push(s.code);
  }
}

// --- CCSS ELA: grade 6 RL, RI, W, SL, L and their lettered sub-standards ---------------------

function buildCcss(nodes: CspStandard[]): Standard[] {
  const notation = /^(RL|RI|W|SL|L)\.6\.(\d+)([a-z])?$/;
  const codeById = new Map<string, string>();
  const out: Standard[] = [];
  for (const node of nodes) {
    const m = node.statementNotation?.match(notation);
    if (!m) continue; // anchors (R.CCR.1), RH/RST/WHST, and uncoded headings
    const [, strand, num, letter] = m;
    const code = `${strand}.${GRADE}.${num}${letter ? `.${letter}` : ''}`;
    let parent: string | undefined;
    if (letter) {
      parent = codeById.get(node.parentId ?? '') ?? fail(`${code}: parent not a standard`);
      if (parent !== `${strand}.${GRADE}.${num}`) fail(`${code}: hierarchy says parent ${parent}`);
    }
    codeById.set(node.id, code);
    // CSP writes grade bands with an em dash ("6—8"); the CDE text uses an en dash.
    const text = cleanText(node.description).replace(/(\d)—(\d)/g, '$1–$2');
    out.push(makeStandard(code, 'CCSS-ELA', text, parent));
  }
  return out;
}

// --- ELD: Part I and Part II items, sub-items and proficiency levels -------------------------

const LEVELS = { Em: 'emerging', Ex: 'expanding', Br: 'bridging' } as const;
type LevelKey = (typeof LEVELS)[keyof typeof LEVELS];

function buildEld(nodes: CspStandard[]): Standard[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const notation = /^ELD\.(PI|PII)\.6\.(\d+)([a-z])?\.(Em|Ex|Br)$/;
  const romanToPart: Record<string, string> = { 'I.': 'PI', 'II.': 'PII' };

  // item code -> sub-letter ('' for the item itself) -> level -> text
  const items = new Map<string, Map<string, Partial<Record<LevelKey, string>>>>();

  for (const node of nodes) {
    if (!node.statementNotation) continue; // part, strand and item headings
    const m =
      node.statementNotation.match(notation) ?? fail(`bad ELD code ${node.statementNotation}`);
    const [, cspPart, cspNum, letter = '', levelAbbr] = m;

    // Item number and part come from the hierarchy: level text -> item -> strand -> part.
    const item = byId.get(node.parentId ?? '') ?? fail(`${node.statementNotation}: no item`);
    const itemNum = item.listId?.match(/^(\d+)\.$/)?.[1] ?? fail(`item listId ${item.listId}`);
    const strand = byId.get(item.parentId ?? '') ?? fail(`${node.statementNotation}: no strand`);
    const partNode = byId.get(strand.parentId ?? '') ?? fail(`${node.statementNotation}: no part`);
    const part = romanToPart[partNode.listId ?? ''] ?? fail(`unknown part ${partNode.listId}`);

    const cspKey = `${cspPart}.${cspNum}${letter}`;
    const hierarchyKey = `${part}.${itemNum}${letter}`;
    if (cspKey !== hierarchyKey && KNOWN_ELD_MISCODES[cspKey] !== hierarchyKey) {
      fail(`${node.statementNotation} sits under ${part} item ${itemNum} in the CSP hierarchy`);
    }

    const itemCode = `ELD.${part}.${GRADE}.${itemNum}`;
    const subs = items.get(itemCode) ?? new Map<string, Partial<Record<LevelKey, string>>>();
    items.set(itemCode, subs);
    const levels = subs.get(letter) ?? {};
    subs.set(letter, levels);
    const level = LEVELS[levelAbbr as keyof typeof LEVELS];
    if (levels[level]) fail(`${node.statementNotation}: duplicate level`);
    const code = letter ? `${itemCode}.${letter}` : itemCode;
    levels[level] = applyFix(`${code}:${level}`, cleanText(node.description));
  }

  const out: Standard[] = [];
  for (const [itemCode, subs] of items) {
    const titleKey = itemCode.replace(`ELD.`, '').replace(`.${GRADE}.`, '.');
    const title = ELD_TITLES[titleKey] ?? fail(`no title for ${itemCode}`);
    const toLevels = (code: string, l: Partial<Record<LevelKey, string>>): ProficiencyLevels => ({
      emerging: l.emerging ?? fail(`${code}: no Emerging text`),
      expanding: l.expanding ?? fail(`${code}: no Expanding text`),
      bridging: l.bridging ?? fail(`${code}: no Bridging text`),
    });
    const own = subs.get('');
    const letters = [...subs.keys()].filter((k) => k !== '').sort();
    if (own && letters.length) fail(`${itemCode}: has both its own levels and sub-items`);
    out.push(makeStandard(itemCode, 'ELD', title, undefined, own && toLevels(itemCode, own)));
    for (const letter of letters) {
      const code = `${itemCode}.${letter}`;
      // A sub-item has no title of its own in the CDE text; it carries its item's title.
      out.push(makeStandard(code, 'ELD', title, itemCode, toLevels(code, subs.get(letter)!)));
    }
  }
  const missing = Object.keys(ELD_TITLES).filter(
    (k) => !items.has(`ELD.${k.replace('.', `.${GRADE}.`)}`),
  );
  if (missing.length) fail(`ELD items missing from CSP: ${missing.join(', ')}`);
  return out;
}

// --- MSLS: standard (2), sub-level (2.1) and lettered item (2.1.a) ---------------------------

function buildMsls(nodes: CspStandard[]): Standard[] {
  const codeById = new Map<string, string>();
  const out: Standard[] = [];
  for (const node of nodes) {
    const listId = node.listId ?? fail(`MSLS node ${node.id} has no listId`);
    const parent = node.parentId ? codeById.get(node.parentId) : undefined;
    let code: string;
    if (node.depth === 0) {
      const num = listId.match(/^(\d+)\.$/)?.[1] ?? fail(`MSLS standard listId ${listId}`);
      code = `MSLS.${GRADE}.${num}`;
    } else if (node.depth === 1) {
      const [, std, sub] = listId.match(/^(\d+)\.(\d+)$/) ?? fail(`MSLS sub-level ${listId}`);
      code = `MSLS.${GRADE}.${std}.${sub}`;
      if (parent !== `MSLS.${GRADE}.${std}`) fail(`${code} sits under ${parent}`);
    } else if (node.depth === 2) {
      const letter = listId.match(/^([a-z])\.$/)?.[1] ?? fail(`MSLS item listId ${listId}`);
      code = `${parent ?? fail(`MSLS item ${listId} has no parent`)}.${letter}`;
    } else {
      fail(`unexpected MSLS depth ${node.depth}`);
    }
    if (codeById.has(node.id) || out.some((s) => s.code === code)) fail(`duplicate ${code}`);
    codeById.set(node.id, code);
    out.push(makeStandard(code, 'MSLS', cleanText(node.description), parent));
  }
  return out;
}

// --- Assemble ---------------------------------------------------------------------------------

const builders: Record<Framework, (nodes: CspStandard[]) => Standard[]> = {
  'CCSS-ELA': buildCcss,
  ELD: buildEld,
  MSLS: buildMsls,
};

const standards: Standard[] = [];
const documents = [];
for (const { framework, file } of SOURCES) {
  const { doc, nodes } = loadSource(file);
  const built = builders[framework](nodes);
  linkChildren(built);
  standards.push(...built);
  documents.push({
    framework,
    title: doc.document.title,
    asnIdentifier: doc.document.asnIdentifier,
    cspFile: file,
    authority: doc.document.sourceURL,
    license: doc.license.title,
    rightsHolder: doc.license.rightsHolder,
  });
}

const unusedFixes = Object.keys(TEXT_FIXES).filter((k) => !usedFixes.has(k));
if (unusedFixes.length) fail(`text fixes never applied: ${unusedFixes.join(', ')}`);
const codes = new Set(standards.map((s) => s.code));
if (codes.size !== standards.length) fail('duplicate codes');

const dataset = {
  attribution: {
    source: 'Common Standards Project (https://commonstandardsproject.com)',
    license: 'CC BY 3.0 US',
    licenseUrl: 'http://creativecommons.org/licenses/by/3.0/us/',
    rightsHolder: 'D2L Corporation (formerly Desire2Learn Incorporated)',
    note: 'Derived from CSP data and corrected against the California Department of Education PDFs, which are the authority.',
    documents,
    corrections: CORRECTIONS,
  },
  standards,
};

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
const count = (f: Framework) => standards.filter((s) => s.framework === f).length;
console.log(
  `Wrote ${standards.length} standards (CCSS-ELA ${count('CCSS-ELA')}, ELD ${count('ELD')}, MSLS ${count('MSLS')}) to ${outFile}`,
);
