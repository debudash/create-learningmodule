import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseOutlineCsv } from './parse.js';
import { confirmImport } from './resolve.js';
import type { Resolution } from './types.js';

const SAMPLE = readFileSync(
  fileURLToPath(new URL('../../../fixtures/outlines/g6-u4-lightning-thief.csv', import.meta.url)),
  'utf8',
);

const proposal = parseOutlineCsv(SAMPLE);
const blocking = proposal.issues.filter((i) => i.severity === 'blocking');
const acceptAllSuggestions: Resolution[] = blocking.map((i) => ({
  issueId: i.id,
  action: 'accept-suggestion',
}));

function lessonCodes(result: ReturnType<typeof confirmImport>, key: string) {
  if (!result.ok) throw new Error(result.errors.join('; '));
  return result.confirmed.lessons.find((l) => l.key === key)!;
}

describe('confirmImport', () => {
  it('refuses while Blocking issues are unresolved', () => {
    const result = confirmImport(proposal, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.unresolved.map((i) => i.id).sort()).toEqual(blocking.map((i) => i.id).sort());
  });

  it('confirms once every Blocking issue has a resolution', () => {
    const result = confirmImport(proposal, acceptAllSuggestions);
    expect(result.ok).toBe(true);
    const l4 = lessonCodes(result, 'L4');
    expect(l4.focusStandards.map((s) => s.code)).toEqual(['RL.6.1', 'RL.6.2', 'L.6.4']);
    const l22 = lessonCodes(result, 'L22');
    expect(l22.focusStandards.map((s) => s.code)).not.toContain('RL.6.9.a');
  });

  it('removes duplicates created by a resolution', () => {
    // L22 lists RL.6.9 and RL.6.9.a; accepting the suggestion (RL.6.9) must not list it twice.
    const result = confirmImport(proposal, acceptAllSuggestions);
    const focus = lessonCodes(result, 'L22').focusStandards.map((s) => s.code);
    expect(focus.filter((c) => c === 'RL.6.9')).toHaveLength(1);
  });

  it('applies a typed replacement and validates it', () => {
    const rl69a = blocking.find((i) => i.kind === 'unknown-standard' && i.lessonKey === 'L26')!;
    const others = acceptAllSuggestions.filter((r) => r.issueId !== rl69a.id);

    const good = confirmImport(proposal, [...others, { issueId: rl69a.id, action: 'replace', value: 'W.6.9a' }]);
    expect(lessonCodes(good, 'L26').supportingStandards.map((s) => s.code)).toContain('W.6.9.a');

    const bad = confirmImport(proposal, [...others, { issueId: rl69a.id, action: 'replace', value: 'RL.6.99' }]);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]).toMatch(/RL\.6\.99/);
  });

  it('removes an entry when asked', () => {
    const stray = blocking.find((i) => i.kind === 'malformed-standard')!;
    const others = acceptAllSuggestions.filter((r) => r.issueId !== stray.id);
    const result = confirmImport(proposal, [...others, { issueId: stray.id, action: 'remove' }]);
    expect(lessonCodes(result, 'L4').focusStandards.map((s) => s.code)).toEqual(['RL.6.1', 'L.6.4']);
  });

  it('does not let a Blocking issue be accepted as written', () => {
    const stray = blocking.find((i) => i.kind === 'malformed-standard')!;
    const others = acceptAllSuggestions.filter((r) => r.issueId !== stray.id);
    const result = confirmImport(proposal, [...others, { issueId: stray.id, action: 'accept' }]);
    expect(result.ok).toBe(false);
  });

  it('applies an accepted ELD suggestion and keeps the Outline description', () => {
    const eld = proposal.issues.find(
      (i) => i.kind === 'eld-description-mismatch' && i.lessonKey === 'L4' && i.suggestion,
    )!;
    const result = confirmImport(proposal, [...acceptAllSuggestions, { issueId: eld.id, action: 'accept-suggestion' }]);
    const l4 = lessonCodes(result, 'L4');
    const ref = l4.eldStandards.find((e) => e.description === 'Use transitions to connect ideas')!;
    expect(ref.code).toBe(eld.suggestion);
  });

  it('records every issue with how it was resolved', () => {
    const result = confirmImport(proposal, acceptAllSuggestions);
    if (!result.ok) throw new Error('expected ok');
    expect(result.confirmed.issues).toHaveLength(proposal.issues.length);
    const warning = result.confirmed.issues.find((i) => i.severity === 'warning')!;
    expect(warning.resolution).toBe('accepted-by-default');
    const fixed = result.confirmed.issues.find((i) => i.kind === 'malformed-standard')!;
    expect(fixed).toMatchObject({ resolution: 'accept-suggestion', resolvedValue: 'RL.6.2' });
  });

  it('rejects resolutions for issues that do not exist', () => {
    const result = confirmImport(proposal, [...acceptAllSuggestions, { issueId: 'nope', action: 'remove' }]);
    expect(result.ok).toBe(false);
  });
});

/** A minimal Outline with the sample's columns, for issue cases the sample does not contain. */
function miniOutline(lessonRow: Partial<Record<'type' | 'eld' | 'supporting', string>>): string {
  const headers = [
    'Filename', 'Lesson', 'Lesson #', 'Type of Lesson', 'Days', 'Text Dependent Question tied to the EQ',
    'Lesson Description', 'Text Set Choice', 'Homework', 'Focus Standards (assessed)',
    'Additional Supported CA ELA Standards', 'CA Media Literacy Standards',
    'Skill or content that will be needed for Performance Task', 'Foundational Skills Focus',
    'Vocabulary', 'Designated ELD Standards',
  ];
  const row = [
    'L1_ELA_TE_G6_U4_CA_Core', 'Spark', 'Lesson 1', lessonRow.type ?? 'Spark 1', '1', 'N/A',
    'Opening', '', '', 'RL.6.1', lessonRow.supporting ?? '', '', '', '', '', lessonRow.eld ?? '',
  ];
  const csv = (cells: string[]) => cells.map((c) => `"${c.replace(/"/g, '""')}"`).join(',');
  return [csv(['G6, U4: The Lightning Thief by Rick Riordan']), csv(headers), csv(['', 'Spark']), csv(row)].join('\n');
}

describe('confirmImport: issue kinds outside the sample', () => {
  // LCG-1 regression. Found by: Phase 1 spec review (an unknown Lesson Type could never be resolved).
  it('LCG-1: resolves an unknown Lesson Type by choosing a type', () => {
    const odd = parseOutlineCsv(miniOutline({ type: 'Seminar' }));
    const issue = odd.issues.find((i) => i.kind === 'unknown-lesson-type')!;
    expect(issue.severity).toBe('blocking');

    const chosen = confirmImport(odd, [{ issueId: issue.id, action: 'replace', value: 'academic-discussion' }]);
    expect(chosen.ok).toBe(true);
    if (chosen.ok) expect(chosen.confirmed.lessons[0]!.lessonType).toBe('academic-discussion');

    const invalid = confirmImport(odd, [{ issueId: issue.id, action: 'replace', value: 'seminar' }]);
    expect(invalid.ok).toBe(false);
  });

  // LCG-2 regression. Found by: Phase 1 spec review (a mistyped ELD code was stored as a Designer Note).
  it('LCG-2: blocks on a malformed ELD code instead of keeping it as a note', () => {
    const odd = parseOutlineCsv(
      miniOutline({
        eld: [
          '• ELD.P1.6.6 – Read closely',
          '• ELD.PI.6.1 – Participate in discussions',
          'Keep ELD light today',
        ].join('\n'),
      }),
    );
    const lesson = odd.lessons[0]!;
    const malformed = odd.issues.filter((i) => i.kind === 'malformed-standard');
    expect(malformed).toMatchObject([
      { severity: 'blocking', field: 'eldStandards', raw: 'ELD.P1.6.6 – Read closely' },
    ]);
    expect(lesson.designerNotes).toEqual(['Keep ELD light today']);
    expect(lesson.eldStandards.map((e) => e.code)).toEqual(['ELD.P1.6.6', 'ELD.PI.6.1']);

    const fixed = confirmImport(odd, [{ issueId: malformed[0]!.id, action: 'replace', value: 'ELD.PI.6.6' }]);
    expect(fixed.ok).toBe(true);
    if (fixed.ok) expect(fixed.confirmed.lessons[0]!.eldStandards.map((e) => e.code)).toContain('ELD.PI.6.6');
  });
});
