import { describe, expect, it } from 'vitest';
import { normalizeCode } from './index.js';
import type { Framework } from './index.js';

const valid: [Framework, string, string][] = [
  // CCSS ELA: canonical, missing and extra dots, case, whitespace, bullets, trailing punctuation
  ['CCSS-ELA', 'RL.6.1', 'RL.6.1'],
  ['CCSS-ELA', 'W.6.3a', 'W.6.3.a'],
  ['CCSS-ELA', 'W.6.3.a', 'W.6.3.a'],
  ['CCSS-ELA', 'SL.6.1.a', 'SL.6.1.a'],
  ['CCSS-ELA', 'SL6.1a', 'SL.6.1.a'],
  ['CCSS-ELA', 'L..6.4..b', 'L.6.4.b'],
  ['CCSS-ELA', '  RI.6.4 ', 'RI.6.4'],
  ['CCSS-ELA', '• RL.6.10,', 'RL.6.10'],
  ['CCSS-ELA', '- L.6.5.c.', 'L.6.5.c'],
  ['CCSS-ELA', 'rl.6.2', 'RL.6.2'],
  ['CCSS-ELA', 'W.6.3.A', 'W.6.3.a'],
  ['CCSS-ELA', 'RL 6.1', 'RL.6.1'],
  // purely syntactic: a code that does not exist still normalises
  ['CCSS-ELA', 'RL.6.9.a', 'RL.6.9.a'],
  ['CCSS-ELA', 'RL.7.1', 'RL.7.1'],
  // ELD: with or without the prefix, sub-item letter with or without a dot, level suffix dropped
  ['ELD', 'ELD.PI.6.6', 'ELD.PI.6.6'],
  ['ELD', 'PI.6.6', 'ELD.PI.6.6'],
  ['ELD', 'ELD.PII.6.2.a', 'ELD.PII.6.2.a'],
  ['ELD', 'ELD.PI.6.6a', 'ELD.PI.6.6.a'],
  ['ELD', 'ELD.PI.6.6a.Em', 'ELD.PI.6.6.a'],
  ['ELD', 'ELD.PI.6.1.Ex', 'ELD.PI.6.1'],
  ['ELD', 'PII.6.7.Br', 'ELD.PII.6.7'],
  ['ELD', 'PI.6.10b.Bridging', 'ELD.PI.6.10.b'],
  ['ELD', '• ELD.PI.6.7', 'ELD.PI.6.7'],
  ['ELD', 'eld.pii.6.5', 'ELD.PII.6.5'],
  ['ELD', 'ELD PI 6.6', 'ELD.PI.6.6'],
  // Media Literacy: bare codes are namespaced and take grade 6
  ['MSLS', '2.1.a', 'MSLS.6.2.1.a'],
  ['MSLS', '2.1a', 'MSLS.6.2.1.a'],
  ['MSLS', ' 4.3.a ', 'MSLS.6.4.3.a'],
  ['MSLS', '2.1', 'MSLS.6.2.1'],
  ['MSLS', 'MSLS.6.2.1.a', 'MSLS.6.2.1.a'],
  ['MSLS', 'MSLS.6.2', 'MSLS.6.2'],
];

describe('normalizeCode', () => {
  it.each(valid)('%s %j -> %s', (framework, raw, code) => {
    expect(normalizeCode(raw, framework)).toEqual({ ok: true, code });
  });

  it('places a bare Media Literacy code at the grade it is given', () => {
    expect(normalizeCode('2.1.a', 'MSLS', 7)).toEqual({ ok: true, code: 'MSLS.7.2.1.a' });
  });

  const malformed: [Framework, string][] = [
    ['CCSS-ELA', '6.2'],
    ['CCSS-ELA', 'RL6'],
    ['CCSS-ELA', 'RL.6'],
    ['CCSS-ELA', ''],
    ['CCSS-ELA', '   '],
    ['CCSS-ELA', '•'],
    ['CCSS-ELA', 'RH.6.1'],
    ['CCSS-ELA', 'W.6.3.a–e'],
    ['CCSS-ELA', 'W.6.3.ab'],
    ['ELD', 'ELD.6.6'],
    ['ELD', 'ELD.PI.6'],
    ['ELD', '6.2'],
    ['MSLS', 'a.'],
    ['MSLS', '2'],
    ['MSLS', 'RL.6.1'],
  ];
  it.each(malformed)('%s %j is malformed, with a readable reason', (framework, raw) => {
    const result = normalizeCode(raw, framework);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.length).toBeGreaterThan(10);
  });

  it('says why a code was rejected', () => {
    expect(normalizeCode('', 'CCSS-ELA')).toEqual({
      ok: false,
      reason: 'The standard code is empty.',
    });
    expect(normalizeCode('W.6.3.a–e', 'CCSS-ELA')).toMatchObject({ reason: /range/ });
    expect(normalizeCode('RH.6.1', 'CCSS-ELA')).toMatchObject({ reason: /strand "RH"/ });
    expect(normalizeCode('6.2', 'CCSS-ELA')).toMatchObject({
      reason: /"6\.2" is not a CCSS ELA code/,
    });
  });
});
