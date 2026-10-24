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
