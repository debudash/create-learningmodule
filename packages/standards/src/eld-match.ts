import { getStandard, listStandards } from './lookup.js';
import type { Standard } from './types.js';

export interface EldDescriptionMatch {
  matches: boolean;
  official: Standard | undefined;
  suggestion?: Standard;
  score: number;
}

/*
 * How the check works (deterministic, no model):
 *
 * 1. Every ELD item gets a word profile. Its "core" words are its official title plus a short
 *    cue list below (the item's overview wording in the CDE document and the plain words
 *    Outlines use for the same skill, e.g. "transitions" for cohesion); they count fully.
 *    Words that only appear in its level texts, or in its strand's cue list, count half.
 * 2. A description is split into words, stop words dropped, words reduced to a crude stem.
 *    Each word is weighted by how rare it is across the items (inverse document frequency),
 *    so "transitions" (one item) says more than "ideas" (most items).
 * 3. An item's score is the weighted share of the description's words found in its profile.
 * 4. The description fits its official item if that item scores at least FIT_THRESHOLD and no
 *    other item scores more than CLEARER_BY above it. Otherwise the best-scoring item is the
 *    suggestion.
 *
 * Calibrated on the sample Outline (see eld-match.test.ts for every verdict). When the
 * heuristic cannot separate a loose fit from a mismatch it flags: a Warning costs an Editor a
 * click, a missed mismatch reaches state review.
 */

const FIT_THRESHOLD = 0.18;
const CLEARER_BY = 0.45;

/** Core cue words per ELD item, keyed "PI.6" / "PII.2" (part and item number). */
const ITEM_CUES: Record<string, string> = {
  'PI.1':
    'exchange information ideas oral collaborative conversation discussion participate academic',
  'PI.2': 'interact written exchange collaborate peers technology',
  'PI.3': 'opinion justify negotiate persuade counterargument',
  'PI.4': 'adapt adjust language choice context task purpose audience register formal style',
  'PI.5': 'listen active spoken oral presentation',
  'PI.6':
    'read close view explain inference conclusion evidence text relationship meaning implied interpretation sequence describe information',
  'PI.7':
    'evaluate analyze writer speaker author language idea argument evidence meaning convey purpose message develop',
  'PI.8':
    'analyze writer speaker vocabulary language resource phrasing word figurative effect audience shade meaning tone',
  'PI.9': 'present presentation oral deliver plan speak',
  'PI.10': 'write literary informational text summary explain narrative draft',
  'PI.11': 'justify argument opinion evidence claim persuade',
  'PI.12':
    'select precise vocabulary academic domain specific word language structure convey precision',
  'PII.1': 'text structure organize type narrative sequence',
  // PII.2.b's examples are sequence (first/next), cause (as a result) and contrast connectives.
  'PII.2':
    'cohesion transition connect word phrase link refer pronoun temporal sequence cause result contrast logical',
  'PII.3': 'verb phrase tense',
  'PII.4': 'noun phrase expand adjective enrich detail',
  'PII.5': 'modify detail adverbial adverb prepositional phrase expand sentence',
  'PII.6': 'connect combine clause join idea compound complex sentence',
  'PII.7': 'condense idea embedded clause nominalization precise sentence',
};

/** Half-weight cue words for each strand: the strand's CSP heading plus common Outline wording. */
const STRAND_CUES: [RegExp, string][] = [
  [/^PI\.[1-4]$/, 'collaborative dialogue engage discussion conversation partner group others'],
  [
    /^PI\.[5-8]$/,
    'interpretive comprehension analyze read text spoken meaning author character narrative theme plot setting structure symbol perspective compare contrast develop',
  ],
  [
    /^PI\.(9|1[0-2])$/,
    'productive create produce oral presentation written text write draft revise plan',
  ],
  [/^PII\.[1-2]$/, 'structure cohesive text organize'],
  [/^PII\.[3-5]$/, 'expand enrich idea detail sentence'],
  [/^PII\.[6-7]$/, 'connect condense idea sentence clause'],
];

const STOPWORDS = new Set(
  (
    'a an and are as at be by for from in into of on or the to with using use used how what ' +
    'their them they this that these those its it is was were own others other while when ' +
    'e g eg etc i ii iii x y so but not well also can could more most some few many very ' +
    'substantial moderate light minimal support prompting variety increasing growing basic ' +
    'familiar new topic various wide number set detailed appropriate accurately clearly'
  ).split(' '),
);

/** Word forms the crude stemmer would not bring together. */
const WORD_FORMS: Record<string, string> = {
  analysis: 'analyze',
  analytical: 'analyze',
  explanation: 'explain',
  explanatory: 'explain',
  comparison: 'compare',
  comparative: 'compare',
  summarize: 'summary',
  summaries: 'summary',
  connector: 'connect',
  clarity: 'clear',
  clarify: 'clear',
  coherent: 'cohesion',
  coherently: 'cohesion',
  cohesive: 'cohesion',
};

const SUFFIXES = [
  'ations',
  'ation',
  'ions',
  'ion',
  'ings',
  'ing',
  'ies',
  'ied',
  'ives',
  'ive',
  'ally',
  'ly',
  'ed',
  'es',
  'ers',
  'er',
  'ors',
  'or',
  'al',
  'ize',
  'ity',
  'ment',
  's',
  'y',
  'e',
];

/** A crude stemmer: strip common suffixes until none applies, keeping at least 4 letters. */
function stem(word: string): string {
  let w = word;
  for (let changed = true; changed; ) {
    changed = false;
    for (const suffix of SUFFIXES) {
      if (w.endsWith(suffix) && w.length - suffix.length >= 4) {
        w = w.slice(0, -suffix.length);
        changed = true;
        break;
      }
    }
  }
  return w;
}

function words(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z]+/)) {
    if (raw.length < 2 || STOPWORDS.has(raw)) continue;
    const singular = raw.endsWith('s') && WORD_FORMS[raw.slice(0, -1)] ? raw.slice(0, -1) : raw;
    out.add(stem(WORD_FORMS[singular] ?? singular));
  }
  return out;
}

interface Profile {
  item: Standard;
  /** stem -> 1 (core) or 0.5 (level text or strand) */
  weights: Map<string, number>;
}

interface Model {
  profiles: Profile[];
  idf: Map<string, number>;
}

let model: Model | undefined;

function itemKey(item: Standard): string {
  const [, part, , num] = item.code.split('.'); // "ELD.PI.6.6" -> "PI.6"
  return `${part}.${num}`;
}

function buildModel(): Model {
  const eld = listStandards('ELD');
  const profiles = eld
    .filter((s) => !s.parent)
    .map((item) => {
      const key = itemKey(item);
      const levelText = [item, ...eld.filter((s) => s.parent === item.code)]
        .flatMap((s) => (s.levels ? Object.values(s.levels) : []))
        .join(' ');
      const strand = STRAND_CUES.find(([re]) => re.test(key))?.[1] ?? '';
      const weights = new Map<string, number>();
      for (const w of words(`${levelText} ${strand}`)) weights.set(w, 0.5);
      for (const w of words(`${item.text} ${ITEM_CUES[key] ?? ''}`)) weights.set(w, 1);
      return { item, weights };
    });
  const df = new Map<string, number>();
  for (const p of profiles) for (const w of p.weights.keys()) df.set(w, (df.get(w) ?? 0) + 1);
  const n = profiles.length;
  const idf = new Map([...df].map(([w, k]) => [w, Math.log(1 + n / k)]));
  return { profiles, idf };
}

function scoreItem(description: Set<string>, profile: Profile, m: Model): number {
  let total = 0;
  let hit = 0;
  for (const w of description) {
    // A word no ELD item uses ("archetypal") names the Lesson's topic, not a language skill.
    const rarity = m.idf.get(w) ?? 0;
    total += rarity;
    hit += rarity * (profile.weights.get(w) ?? 0);
  }
  return total === 0 ? 0 : hit / total;
}

/**
 * Whether an Outline's short description of an ELD code (e.g. "Use transitions to connect
 * ideas") fits the official item, and if not, the ELD item it fits best. `score` is the
 * official item's fit, 0 to 1. A sub-item code is judged by its item.
 */
export function suggestEldCode(code: string, description: string): EldDescriptionMatch {
  model ??= buildModel();
  const m = model;
  const official = getStandard(code);
  const officialItem = official?.parent ? getStandard(official.parent) : official;
  const d = words(description);
  const ranked = m.profiles
    .map((p) => ({ item: p.item, score: scoreItem(d, p, m) }))
    .sort((a, b) => b.score - a.score);
  const own = ranked.find((r) => r.item.code === officialItem?.code)?.score ?? 0;
  const best = ranked[0]!;
  const matches =
    officialItem?.framework === 'ELD' && own >= FIT_THRESHOLD && best.score - own <= CLEARER_BY;
  const suggestion =
    !matches && best.item !== officialItem && best.score > 0 ? best.item : undefined;
  return {
    matches,
    official,
    ...(suggestion ? { suggestion } : {}),
    score: Math.round(own * 100) / 100,
  };
}
