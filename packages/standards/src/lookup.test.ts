import { describe, expect, it } from 'vitest';
import { getStandard, hasStandard, listStandards, normalizeCode } from './index.js';
import type { Framework } from './index.js';

describe('lookups', () => {
  it('returns a CCSS ELA standard with its official text and sub-standards', () => {
    const w3 = getStandard('W.6.3');
    expect(w3).toMatchObject({ framework: 'CCSS-ELA', grade: 6 });
    expect(w3?.text).toMatch(/^Write narratives to develop real or imagined experiences/);
    expect(w3?.children).toEqual(['W.6.3.a', 'W.6.3.b', 'W.6.3.c', 'W.6.3.d', 'W.6.3.e']);
    expect(w3?.parent).toBeUndefined();
    expect(getStandard('W.6.3.a')?.parent).toBe('W.6.3');
    expect(getStandard('W.6.3.a')?.text).toMatch(/^Engage and orient the reader/);
  });

  it('accepts canonical codes only', () => {
    expect(hasStandard('W.6.3.a')).toBe(true);
    expect(hasStandard('W.6.3a')).toBe(false);
    expect(getStandard('w.6.3.a')).toBeUndefined();
  });

  it('excludes CCR anchors and the literacy-in-content-areas strands', () => {
    const codes = listStandards('CCSS-ELA').map((s) => s.code);
    expect(codes.every((c) => /^(RL|RI|W|SL|L)\.6\.\d+(\.[a-z])?$/.test(c))).toBe(true);
    expect(hasStandard('R.CCR.1')).toBe(false);
    expect(hasStandard('RH.6-8.1')).toBe(false);
    expect(hasStandard('WHST.6-8.1')).toBe(false);
  });

  it('lists each framework in document order, and everything without a filter', () => {
    const counts = Object.fromEntries(
      (['CCSS-ELA', 'ELD', 'MSLS'] as Framework[]).map((f) => [f, listStandards(f).length]),
    );
    expect(counts).toEqual({ 'CCSS-ELA': 81, ELD: 30, MSLS: 63 });
    expect(listStandards()).toHaveLength(81 + 30 + 63);
    expect(listStandards('CCSS-ELA')[0]?.code).toBe('RL.6.1');
    expect(listStandards('ELD')[0]?.code).toBe('ELD.PI.6.1');
  });

  it('keeps parent and children links consistent', () => {
    for (const s of listStandards()) {
      for (const child of s.children) expect(getStandard(child)?.parent).toBe(s.code);
      if (s.parent) expect(getStandard(s.parent)?.children).toContain(s.code);
    }
  });

  it('does not let a caller change the shared data', () => {
    const rl1 = getStandard('RL.6.1')!;
    expect(() => {
      (rl1 as { text: string }).text = 'changed';
    }).toThrow();
    expect(getStandard('RL.6.1')?.text).not.toBe('changed');
  });

  it('stores text with normalised whitespace and the CDE en dash in grade bands', () => {
    for (const s of listStandards()) {
      for (const t of [s.text, ...Object.values(s.levels ?? {})]) {
        expect(t).toBe(t.replace(/\s+/g, ' ').trim());
      }
    }
    expect(getStandard('RL.6.10')?.text).toContain('grades 6–8 text complexity band');
  });
});

describe('ELD', () => {
  it('gives an item without sub-items its title and all three proficiency levels', () => {
    const pi1 = getStandard('ELD.PI.6.1');
    expect(pi1?.text).toBe('Exchanging information/ideas');
    expect(pi1?.children).toEqual([]);
    expect(pi1?.levels?.emerging).toMatch(/^Engage in conversational exchanges/);
    expect(pi1?.levels?.expanding).toMatch(/^Contribute to class, group, and partner discussions/);
    expect(pi1?.levels?.bridging).toMatch(/providing useful feedback\.$/);
  });

  it('puts levels on the sub-items of an item that has them, not on the item', () => {
    const pi6 = getStandard('ELD.PI.6.6');
    expect(pi6?.text).toBe('Reading/viewing closely');
    expect(pi6?.levels).toBeUndefined();
    expect(pi6?.children).toEqual(['ELD.PI.6.6.a', 'ELD.PI.6.6.b', 'ELD.PI.6.6.c']);
    const sub = getStandard('ELD.PI.6.6.b');
    expect(sub?.parent).toBe('ELD.PI.6.6');
    expect(sub?.levels?.bridging).toMatch(/precise academic verbs/);
  });

  it('returns all three levels for every ELD code that carries text', () => {
    for (const s of listStandards('ELD')) {
      const hasLevels = s.children.length === 0;
      expect(s.levels !== undefined).toBe(hasLevels);
      if (s.levels) {
        expect(Object.keys(s.levels).sort()).toEqual(['bridging', 'emerging', 'expanding']);
        for (const t of Object.values(s.levels)) expect(t.length).toBeGreaterThan(20);
      }
    }
  });

  it('applies the Part II item 2 correction (CSP codes it ELD.PII.6.1a/1b)', () => {
    const pii2 = getStandard('ELD.PII.6.2');
    expect(pii2?.text).toBe('Understanding cohesion');
    expect(pii2?.children).toEqual(['ELD.PII.6.2.a', 'ELD.PII.6.2.b']);
    expect(getStandard('ELD.PII.6.2.a')?.levels?.emerging).toMatch(
      /^Apply basic understanding of language resources for referring the reader back or forward/,
    );
    expect(getStandard('ELD.PII.6.2.b')?.levels?.bridging).toMatch(/transitional words/);
    // Item 1 keeps only its own text, with no sub-items borrowed from item 2.
    const pii1 = getStandard('ELD.PII.6.1');
    expect(pii1?.text).toBe('Understanding text structure');
    expect(pii1?.children).toEqual([]);
    expect(pii1?.levels?.emerging).toMatch(/how different text types are organized/);
    expect(hasStandard('ELD.PII.6.1.a')).toBe(false);
  });

  it('has every Part I and Part II item and no Part III codes', () => {
    const items = listStandards('ELD')
      .filter((s) => !s.parent)
      .map((s) => s.code);
    expect(items).toEqual([
      ...Array.from({ length: 12 }, (_, i) => `ELD.PI.6.${i + 1}`),
      ...Array.from({ length: 7 }, (_, i) => `ELD.PII.6.${i + 1}`),
    ]);
  });
});

describe('Media Literacy (MSLS)', () => {
  it('builds standard, sub-level and lettered codes from the hierarchy', () => {
    expect(getStandard('MSLS.6.2')?.text).toBe('Students evaluate information.');
    expect(getStandard('MSLS.6.2')?.children).toEqual(['MSLS.6.2.1', 'MSLS.6.2.2', 'MSLS.6.2.3']);
    expect(getStandard('MSLS.6.2.1')?.parent).toBe('MSLS.6.2');
    expect(getStandard('MSLS.6.2.1.a')).toMatchObject({
      framework: 'MSLS',
      grade: 6,
      parent: 'MSLS.6.2.1',
      text: 'Analyze information from illustrations, photographs, charts, graphs, maps, tables, and captions.',
    });
  });
});

/**
 * Every code the sample Outline cites (docs/source/sample-unit-outline/lesson-outline_gid1723306320.csv,
 * Focus, Additional, ELD and Media Literacy columns), ranges expanded. Known issues found by the
 * Outline research: RL.6.9.a does not exist (used four times) and "6.2" is malformed (Lesson 4).
 */
// prettier-ignore
const OUTLINE_CCSS = [
  'L.6.1', 'L.6.1.a', 'L.6.1.b', 'L.6.1.c', 'L.6.1.d', 'L.6.1.e', 'L.6.2', 'L.6.2.a', 'L.6.2.b',
  'L.6.3', 'L.6.3.a', 'L.6.3.b', 'L.6.4', 'L.6.4.a', 'L.6.4.b', 'L.6.4.c', 'L.6.4.d', 'L.6.5',
  'L.6.5.a', 'L.6.5.b', 'L.6.5.c', 'L.6.6', 'RI.6.1', 'RI.6.2', 'RI.6.3', 'RI.6.4', 'RI.6.7',
  'RI.6.9', 'RL.6.1', 'RL.6.10', 'RL.6.2', 'RL.6.3', 'RL.6.4', 'RL.6.5', 'RL.6.6', 'RL.6.7',
  'RL.6.9', 'SL.6.1', 'SL.6.1.a', 'SL.6.1.b', 'SL.6.1.c', 'SL.6.1.d', 'SL.6.2', 'SL.6.4',
  'SL.6.4.a', 'SL.6.5', 'SL.6.6', 'W.6.10', 'W.6.2', 'W.6.2.a', 'W.6.2.b', 'W.6.2.c', 'W.6.2.d',
  'W.6.2.e', 'W.6.2.f', 'W.6.3', 'W.6.3.a', 'W.6.3.b', 'W.6.3.c', 'W.6.3.d', 'W.6.3.e', 'W.6.4',
  'W.6.5', 'W.6.6', 'W.6.8', 'W.6.9', 'W.6.9.a',
];
// prettier-ignore
const OUTLINE_ELD = [
  'ELD.PI.6.1', 'ELD.PI.6.10', 'ELD.PI.6.2', 'ELD.PI.6.4', 'ELD.PI.6.5', 'ELD.PI.6.6',
  'ELD.PI.6.7', 'ELD.PII.6.1', 'ELD.PII.6.3', 'ELD.PII.6.4', 'ELD.PII.6.5', 'ELD.PII.6.6',
];
const OUTLINE_MSLS = ['2.1.a', '2.1.b', '2.2.a', '3.3.a', '4.3.a'];

describe('sample Outline codes', () => {
  const cases: [Framework, string[]][] = [
    ['CCSS-ELA', OUTLINE_CCSS],
    ['ELD', OUTLINE_ELD],
    ['MSLS', OUTLINE_MSLS],
  ];
  it.each(cases)('every %s code normalises and resolves', (framework, raws) => {
    for (const raw of raws) {
      const result = normalizeCode(raw, framework);
      expect(result, raw).toMatchObject({ ok: true });
      if (result.ok) expect(hasStandard(result.code), result.code).toBe(true);
    }
  });

  it('RL.6.9.a is well-formed but does not exist', () => {
    expect(normalizeCode('RL.6.9.a', 'CCSS-ELA')).toEqual({ ok: true, code: 'RL.6.9.a' });
    expect(hasStandard('RL.6.9.a')).toBe(false);
  });

  it('"6.2" in a CCSS ELA cell is malformed', () => {
    expect(normalizeCode('6.2', 'CCSS-ELA').ok).toBe(false);
  });
});
