import { describe, expect, it } from 'vitest';
import { getStandard, suggestEldCode } from './index.js';

/**
 * Every "Designated ELD Standards" entry in the sample Outline
 * (docs/source/sample-unit-outline/lesson-outline_gid1723306320.csv), in Lesson order, with the
 * verdict: [Lesson, code, Outline description, fits the official item?, suggested item].
 *
 * Must flag (the Outline research's seven mis-used codes):
 *   PII.6.5 for cohesion/transitions -> PII.6.2   PII.6.3 for precise vocabulary -> PI.6.12
 *   PII.6.1 for discussion strategies -> PI.6.1   PI.6.5 for revising writing -> PI.6.10
 *   PI.6.4 for presenting -> PI.6.9               PI.6.6 for oral exchange -> PI.6.1
 *   PI.6.2 for summarising -> PI.6.10
 * Also flagged, beyond the research's list (an Editor decides):
 *   L41 PII.6.6 "Adjust language to task and audience": clearly PI.6.4 (Adapting language choices).
 *   L19 PI.6.6 "Support claims with evidence": PI.6.11 (Justifying/arguing) fits far better.
 *   L38 PI.6.6 "Maintain formal style": register is PI.6.4, not reading closely.
 *   L40 PI.6.6 "Clarify and refine ideas", L39 PII.6.4 "Refine sentence-level clarity": too vague
 *   to tie to the official item.
 * Borderline fits (pass, close to the threshold): L7 PII.6.4 "Produce expanded, precise
 * summaries" and L10 "Produce expanded analytical statements" (0.20; only "expanded" ties them to
 * noun-phrase expansion), L3 "Produce expanded, connected explanations" (0.23), L23 PI.6.7 "Apply
 * archetypal ideas" (0.30).
 */
// prettier-ignore
const OUTLINE_ELD: [number, string, string, boolean, string?][] = [
  [1, 'ELD.PI.6.6', 'Exchange information and ideas orally', false, 'ELD.PI.6.1'],
  [1, 'ELD.PI.6.7', 'Analyze how meaning is conveyed', true],
  [1, 'ELD.PII.6.4', 'Expand noun phrases and descriptive language', true],
  [2, 'ELD.PI.6.1', 'Participate in collaborative discussions', true],
  [2, 'ELD.PI.6.6', 'Describe and explain information from texts', true],
  [2, 'ELD.PII.6.3', 'Use content-specific vocabulary accurately', false, 'ELD.PI.6.12'],
  [3, 'ELD.PI.6.7', 'Analyze author purpose and message', true],
  [3, 'ELD.PI.6.6', 'Explain ideas using evidence', true],
  [3, 'ELD.PII.6.4', 'Produce expanded, connected explanations', true],
  [4, 'ELD.PI.6.7', 'Analyze how language creates meaning', true],
  [4, 'ELD.PI.6.6', 'Justify interpretations with evidence', true],
  [4, 'ELD.PII.6.5', 'Use transitions to connect ideas', false, 'ELD.PII.6.2'],
  [5, 'ELD.PI.6.10', 'Write explanatory texts', true],
  [5, 'ELD.PI.6.7', 'Compare how ideas are developed across texts', true],
  [5, 'ELD.PII.6.5', 'Use cohesive language for comparison', false, 'ELD.PII.6.2'],
  [6, 'ELD.PI.6.7', 'Analyze how events shape meaning', true],
  [6, 'ELD.PI.6.6', 'Explain interpretations with evidence', true],
  [6, 'ELD.PII.6.5', 'Use transitions to show sequence and cause', false, 'ELD.PII.6.2'],
  [7, 'ELD.PI.6.2', 'Summarize key ideas accurately', false, 'ELD.PI.6.10'],
  [7, 'ELD.PI.6.7', 'Identify patterns and central ideas', true],
  [7, 'ELD.PII.6.4', 'Produce expanded, precise summaries', true],
  [8, 'ELD.PI.6.7', 'Analyze how language conveys meaning', true],
  [8, 'ELD.PI.6.6', 'Explain character values with evidence', true],
  [8, 'ELD.PII.6.3', 'Use precise descriptive vocabulary', false, 'ELD.PI.6.12'],
  [9, 'ELD.PI.6.7', 'Analyze narrative structure', true],
  [9, 'ELD.PI.6.6', 'Explain cause and effect', true],
  [9, 'ELD.PII.6.5', 'Use temporal transitions accurately', false, 'ELD.PII.6.2'],
  [10, 'ELD.PI.6.7', 'Analyze how language creates tension', true],
  [10, 'ELD.PI.6.6', 'Explain meaning using evidence', true],
  [10, 'ELD.PII.6.4', 'Produce expanded analytical statements', true],
  [11, 'ELD.PI.6.10', 'Write explanatory paragraphs', true],
  [11, 'ELD.PI.6.7', 'Compare ideas across texts', true],
  [11, 'ELD.PII.6.5', 'Use cohesive comparison language', false, 'ELD.PII.6.2'],
  [12, 'ELD.PI.6.7', 'Analyze how themes develop', true],
  [12, 'ELD.PI.6.6', 'Explain mood using evidence', true],
  [12, 'ELD.PII.6.3', 'Use precise descriptive language', false, 'ELD.PI.6.12'],
  [13, 'ELD.PI.6.7', 'Analyze descriptive language', true],
  [13, 'ELD.PI.6.6', 'Explain cultural values with evidence', true],
  [13, 'ELD.PII.6.4', 'Expand descriptive phrases', true],
  [14, 'ELD.PI.6.7', 'Analyze character development', true],
  [14, 'ELD.PI.6.6', 'Explain sequences with evidence', true],
  [14, 'ELD.PII.6.5', 'Use temporal language clearly', false, 'ELD.PII.6.2'],
  [15, 'ELD.PI.6.10', 'Write explanatory comparisons', true],
  [15, 'ELD.PI.6.7', 'Compare how ideas are developed', true],
  [15, 'ELD.PII.6.5', 'Use cohesive compare/contrast language', false, 'ELD.PII.6.2'],
  [16, 'ELD.PI.6.7', 'Analyze symbolic language', true],
  [16, 'ELD.PI.6.6', 'Explain implied meaning with evidence', true],
  [16, 'ELD.PII.6.3', 'Use precise interpretive vocabulary', false, 'ELD.PI.6.12'],
  [17, 'ELD.PI.6.7', 'Analyze character development', true],
  [17, 'ELD.PI.6.6', 'Explain motivations with evidence', true],
  [17, 'ELD.PII.6.5', 'Use causal connectors accurately', false, 'ELD.PII.6.2'],
  [18, 'ELD.PI.6.10', 'Write explanatory text', true],
  [18, 'ELD.PI.6.7', 'Compare ideas across texts', true],
  [18, 'ELD.PII.6.5', 'Maintain cohesion with transitions', false, 'ELD.PII.6.2'],
  [19, 'ELD.PI.6.1', 'Participate in academic discussions', true],
  [19, 'ELD.PI.6.6', 'Support claims with evidence', false, 'ELD.PI.6.11'],
  [19, 'ELD.PII.6.1', 'Use collaborative discussion strategies', false, 'ELD.PI.6.1'],
  [20, 'ELD.PI.6.7', 'Analyze descriptive language', true],
  [20, 'ELD.PI.6.6', 'Explain tone with evidence', true],
  [20, 'ELD.PII.6.3', 'Use precise imagery vocabulary', false, 'ELD.PI.6.12'],
  [21, 'ELD.PI.6.7', 'Analyze narrative structure', true],
  [21, 'ELD.PI.6.6', 'Explain identity development', true],
  [21, 'ELD.PII.6.5', 'Use temporal transitions', false, 'ELD.PII.6.2'],
  [22, 'ELD.PI.6.7', 'Compare how ideas are presented', true],
  [22, 'ELD.PI.6.6', 'Explain author choices', true],
  [22, 'ELD.PII.6.4', 'Produce expanded comparisons', true],
  [23, 'ELD.PI.6.10', 'Write narrative texts', true],
  [23, 'ELD.PI.6.7', 'Apply archetypal ideas', true],
  [23, 'ELD.PII.6.5', 'Organize events coherently', false, 'ELD.PII.6.2'],
  [24, 'ELD.PI.6.10', 'Revise narrative writing', true],
  [24, 'ELD.PI.6.7', 'Compare archetypal elements', true],
  [24, 'ELD.PII.6.5', 'Use cohesive language in revisions', false, 'ELD.PII.6.2'],
  [25, 'ELD.PI.6.7', 'Analyze setting and symbolism', true],
  [25, 'ELD.PI.6.6', 'Explain narrative function with evidence', true],
  [25, 'ELD.PII.6.3', 'Use precise descriptive vocabulary', false, 'ELD.PI.6.12'],
  [26, 'ELD.PI.6.10', 'Write explanatory text', true],
  [26, 'ELD.PI.6.7', 'Compare ideas across texts', true],
  [26, 'ELD.PII.6.5', 'Maintain cohesion with transitions', false, 'ELD.PII.6.2'],
  [28, 'ELD.PI.6.7', 'Analyze character arguments', true],
  [28, 'ELD.PI.6.6', 'Explain conflicts with evidence', true],
  [28, 'ELD.PII.6.5', 'Use logical connectors', false, 'ELD.PII.6.2'],
  [30, 'ELD.PI.6.7', 'Analyze climactic structure', true],
  [30, 'ELD.PI.6.6', 'Explain character development', true],
  [30, 'ELD.PII.6.5', 'Use temporal/causal transitions', false, 'ELD.PII.6.2'],
  [31, 'ELD.PI.6.10', 'Write explanatory text', true],
  [31, 'ELD.PI.6.7', 'Compare cultural portrayals', true],
  [31, 'ELD.PII.6.5', 'Maintain cohesion in comparisons', false, 'ELD.PII.6.2'],
  [32, 'ELD.PI.6.7', 'Analyze dialogue and perspective', true],
  [32, 'ELD.PI.6.6', 'Explain power dynamics', true],
  [32, 'ELD.PII.6.3', 'Use precise analytical vocabulary', false, 'ELD.PI.6.12'],
  [33, 'ELD.PI.6.7', 'Analyze thematic resolution', true],
  [33, 'ELD.PI.6.6', 'Explain consequences and meaning', true],
  [33, 'ELD.PII.6.4', 'Produce expanded synthesis', true],
  [34, 'ELD.PI.6.10', 'Write explanatory text', true],
  [34, 'ELD.PI.6.7', 'Compare narrative outcomes', true],
  [34, 'ELD.PII.6.5', 'Maintain cohesion in writing', false, 'ELD.PII.6.2'],
  [35, 'ELD.PI.6.1', 'Participate in extended academic discussions', true],
  [35, 'ELD.PI.6.7', 'Analyze how retellings change meaning', true],
  [35, 'ELD.PII.6.4', 'Produce expanded oral explanations', true],
  [36, 'ELD.PI.6.10', 'Plan extended explanatory texts', true],
  [36, 'ELD.PI.6.6', 'Explain relationships among ideas', true],
  [36, 'ELD.PII.6.5', 'Use cohesive organizational language', false, 'ELD.PII.6.2'],
  [37, 'ELD.PI.6.10', 'Draft extended explanatory writing', true],
  [37, 'ELD.PI.6.6', 'Clarify explanations with evidence', true],
  [37, 'ELD.PII.6.4', 'Produce expanded, clear sentences', true],
  [38, 'ELD.PI.6.10', 'Continue drafting explanatory text', true],
  [38, 'ELD.PI.6.6', 'Maintain formal style', false, 'ELD.PI.6.4'],
  [38, 'ELD.PII.6.5', 'Use cohesive transitions', false, 'ELD.PII.6.2'],
  [39, 'ELD.PI.6.5', 'Revise writing for clarity', false, 'ELD.PI.6.10'],
  [39, 'ELD.PI.6.10', 'Improve explanatory text', true],
  [39, 'ELD.PII.6.4', 'Refine sentence-level clarity', false, 'ELD.PI.6.10'],
  [40, 'ELD.PI.6.10', 'Finalize extended explanatory writing', true],
  [40, 'ELD.PI.6.6', 'Clarify and refine ideas', false, 'ELD.PI.6.7'],
  [40, 'ELD.PII.6.5', 'Maintain cohesion across the text', false, 'ELD.PII.6.2'],
  [41, 'ELD.PI.6.1', 'Engage in collaborative academic discussion', true],
  [41, 'ELD.PI.6.4', 'Present ideas clearly', false, 'ELD.PI.6.9'],
  [41, 'ELD.PII.6.6', 'Adjust language to task and audience', false, 'ELD.PI.6.4'],
];

describe('suggestEldCode on the sample Outline', () => {
  it.each(OUTLINE_ELD)(
    'Lesson %i %s "%s" -> fits: %s, suggestion: %s',
    (_, code, desc, fits, sug) => {
      const result = suggestEldCode(code, desc);
      expect(result.official?.code).toBe(code);
      expect(result.matches).toBe(fits);
      expect(result.suggestion?.code).toBe(fits ? undefined : sug);
    },
  );

  it('flags each of the seven mis-used codes the Outline research found', () => {
    const flagged = new Set(OUTLINE_ELD.filter(([, , , fits]) => !fits).map(([, code]) => code));
    for (const code of [
      'ELD.PII.6.5',
      'ELD.PII.6.3',
      'ELD.PII.6.1',
      'ELD.PI.6.5',
      'ELD.PI.6.4',
      'ELD.PI.6.6',
      'ELD.PI.6.2',
    ]) {
      expect(flagged).toContain(code);
    }
  });
});

describe('suggestEldCode', () => {
  it('returns the official item and a 0-1 fit score', () => {
    const result = suggestEldCode('ELD.PII.6.5', 'Use transitions to connect ideas');
    expect(result.official).toBe(getStandard('ELD.PII.6.5'));
    expect(result.suggestion).toBe(getStandard('ELD.PII.6.2'));
    expect(result.matches).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(0);
    const fit = suggestEldCode('ELD.PII.6.2', 'Use transitions to connect ideas');
    expect(fit).toMatchObject({ matches: true, score: expect.any(Number) });
    expect(fit.suggestion).toBeUndefined();
    expect(fit.score).toBeGreaterThan(0.5);
  });

  it('judges a sub-item code by its item', () => {
    expect(suggestEldCode('ELD.PII.6.2.b', 'Use temporal transitions')).toMatchObject({
      matches: true,
      official: getStandard('ELD.PII.6.2.b'),
    });
    expect(suggestEldCode('ELD.PI.6.10.b', 'Write brief summaries of texts').matches).toBe(true);
  });

  it('never matches an unknown or non-ELD code, but still suggests an ELD item', () => {
    const unknown = suggestEldCode('ELD.PI.6.13', 'Present ideas clearly');
    expect(unknown).toMatchObject({ matches: false, official: undefined, score: 0 });
    expect(unknown.suggestion?.code).toBe('ELD.PI.6.9');
    expect(suggestEldCode('RL.6.1', 'Cite textual evidence').matches).toBe(false);
  });

  it('flags a description with no ELD vocabulary at all, without a suggestion', () => {
    const result = suggestEldCode('ELD.PI.6.7', 'Lorem ipsum');
    expect(result).toMatchObject({ matches: false, score: 0 });
    expect(result.suggestion).toBeUndefined();
  });

  it('is deterministic', () => {
    const a = suggestEldCode('ELD.PI.6.6', 'Exchange information and ideas orally');
    const b = suggestEldCode('ELD.PI.6.6', 'Exchange information and ideas orally');
    expect(a).toEqual(b);
  });
});
