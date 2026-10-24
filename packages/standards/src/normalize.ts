import type { Framework } from './types.js';

export type NormalizeResult = { ok: true; code: string } | { ok: false; reason: string };

const CCSS_STRANDS = ['RL', 'RI', 'W', 'SL', 'L'];

// Each pattern runs on a cleaned code: upper-case, dots for separators, no bullets.
// Dots between parts are optional where the parts cannot run together ("W.6.3A", "ELDPI.6.6").
const CCSS = /^([A-Z]+)\.?(\d+)\.(\d+)\.?([A-Z])?$/;
const ELD = /^(?:ELD\.?)?P(I{1,3})\.?(\d+)\.(\d+)\.?([A-Z])?(?:\.?(EM|EX|BR)[A-Z]*)?$/;
const MSLS_WITH_GRADE = /^MSLS\.?(\d+)\.(\d+)(?:\.(\d+)(?:\.?([A-Z]))?)?$/;
const MSLS_BARE = /^(\d+)\.(\d+)(?:\.?([A-Z]))?$/;

/**
 * Turns a standard code as written in an Outline into its canonical form:
 *   CCSS-ELA  "W.6.3a"         -> "W.6.3.a"
 *   ELD       "PII.6.1b.Br"    -> "ELD.PII.6.1.b" (proficiency level dropped)
 *   MSLS      "2.1.a"          -> "MSLS.6.2.1.a"  (bare Media Literacy codes take `grade`)
 * Purely syntactic: a well-formed code that does not exist still normalises; use hasStandard.
 */
export function normalizeCode(raw: string, framework: Framework, grade = 6): NormalizeResult {
  const original = raw.trim();
  const cleaned = original
    .replace(/^[\s•◦▪·*-]+/u, '') // list bullets
    .replace(/[\s.,;:]+$/, '') // trailing punctuation
    .toUpperCase()
    .replace(/\s+/g, '.')
    .replace(/\.{2,}/g, '.');

  if (cleaned === '') return { ok: false, reason: 'The standard code is empty.' };
  if (/[–—]/.test(cleaned) || /\.[A-Z]-[A-Z]$/.test(cleaned)) {
    return {
      ok: false,
      reason: `"${original}" is a range of codes; expand it into single codes first.`,
    };
  }

  if (framework === 'CCSS-ELA') {
    const m = cleaned.match(CCSS);
    if (!m) {
      return {
        ok: false,
        reason: `"${original}" is not a CCSS ELA code like "RL.6.1" or "W.6.3.a" (strand, grade, standard, optional letter).`,
      };
    }
    const [, strand = '', g, num, letter] = m;
    if (!CCSS_STRANDS.includes(strand)) {
      return {
        ok: false,
        reason: `"${original}" has strand "${strand}"; expected one of ${CCSS_STRANDS.join(', ')}.`,
      };
    }
    return ok(`${strand}.${Number(g)}.${Number(num)}`, letter);
  }

  if (framework === 'ELD') {
    const m = cleaned.match(ELD);
    if (!m) {
      return {
        ok: false,
        reason: `"${original}" is not an ELD code like "ELD.PI.6.6" or "ELD.PII.6.2.a" (part, grade, item, optional letter).`,
      };
    }
    const [, part, g, item, letter] = m;
    return ok(`ELD.P${part}.${Number(g)}.${Number(item)}`, letter);
  }

  const withGrade = cleaned.match(MSLS_WITH_GRADE);
  if (withGrade) {
    const [, g, std, sub, letter] = withGrade;
    return ok(`MSLS.${Number(g)}.${Number(std)}${sub ? `.${Number(sub)}` : ''}`, letter);
  }
  const bare = cleaned.match(MSLS_BARE);
  if (bare) {
    const [, std, sub, letter] = bare;
    return ok(`MSLS.${grade}.${Number(std)}.${Number(sub)}`, letter);
  }
  return {
    ok: false,
    reason: `"${original}" is not a Media Literacy code like "2.1.a" or "MSLS.6.2.1.a".`,
  };
}

function ok(base: string, letter?: string): NormalizeResult {
  return { ok: true, code: letter ? `${base}.${letter.toLowerCase()}` : base };
}
