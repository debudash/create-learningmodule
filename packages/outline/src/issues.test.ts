import { describe, expect, it } from 'vitest';
import { miniOutlineCsv, sampleOutlineCsv } from '@lcg/fixtures';
import { applyToGroup, groupIssues, resolutionOptions, unresolvedBlocking } from './issues.js';
import { parseOutlineCsv } from './parse.js';
import type { OutlineIssue, Resolution } from './types.js';

const proposal = parseOutlineCsv(sampleOutlineCsv());
const issue = (id: string) => proposal.issues.find((i) => i.id === id)!;

describe('groupIssues', () => {
  const groups = groupIssues(proposal.issues);

  it('puts Blocking groups before Warning groups, each in Outline order', () => {
    const severities = groups.map((g) => g.severity);
    expect(severities.indexOf('warning')).toBeGreaterThan(severities.lastIndexOf('blocking'));
    expect(groups[0]!.issues[0]!.lessonKey).toBe('L4');
  });

  it('keeps every issue exactly once', () => {
    const ids = groups.flatMap((g) => g.issues.map((i) => i.id));
    expect(ids.sort()).toEqual(proposal.issues.map((i) => i.id).sort());
  });

  it('groups identical issues across Lessons and standards lists', () => {
    // RL.6.9.a appears in L22 (Focus and Supporting), L26 and L31.
    const rl69a = groups.find((g) => g.code === 'RL.6.9.a')!;
    expect(rl69a.issues.map((i) => i.id)).toEqual([
      'L22.focusStandards.RL.6.9.a',
      'L22.supportingStandards.RL.6.9.a',
      'L26.supportingStandards.RL.6.9.a',
      'L31.supportingStandards.RL.6.9.a',
    ]);
    expect(rl69a.suggestion).toBe('RL.6.9');
  });

  it('groups ELD Warnings only when the code and the description both match', () => {
    const cohesion = groups.find(
      (g) => g.raw === 'ELD.PII.6.5 – Maintain cohesion with transitions',
    )!;
    expect(cohesion.issues.map((i) => i.lessonKey)).toEqual(['L18', 'L26']);
    const otherPii65 = groups.filter((g) => g.code === 'ELD.PII.6.5' && g !== cohesion);
    expect(otherPii65.length).toBeGreaterThan(5);
  });

  it('never groups Unit-level issues', () => {
    const unitLevel: OutlineIssue[] = [
      { id: 'a', severity: 'warning', kind: 'day-total-mismatch', message: 'x', raw: '40' },
      { id: 'b', severity: 'warning', kind: 'day-total-mismatch', message: 'x', raw: '40' },
    ];
    expect(groupIssues(unitLevel)).toHaveLength(2);
  });
});

describe('resolutionOptions', () => {
  it('offers the suggestion, a replacement and removal for a Blocking standard', () => {
    expect(resolutionOptions(issue('L4.focusStandards.6.2'))).toEqual([
      'accept-suggestion',
      'replace',
      'remove',
    ]);
  });

  it('adds keep-as-written for a standards Warning', () => {
    expect(
      resolutionOptions(issue('L1.eldStandards.ELD.PI.6.6.exchange-information-and-ideas-orally')),
    ).toEqual(['accept-suggestion', 'replace', 'remove', 'accept']);
  });

  it('only lets a Warning about no standard be kept as written', () => {
    expect(resolutionOptions(issue('L35.filename'))).toEqual(['accept']);
    expect(resolutionOptions(issue('unit.filenames'))).toEqual(['accept']);
  });

  it('resolves an unknown Lesson Type only by replacing it', () => {
    const odd = parseOutlineCsv(miniOutlineCsv({ type: 'Mystery Day' }));
    expect(resolutionOptions(odd.issues.find((i) => i.kind === 'unknown-lesson-type')!)).toEqual([
      'replace',
    ]);
  });
});

describe('unresolvedBlocking', () => {
  const blocking = proposal.issues.filter((i) => i.severity === 'blocking');

  it('lists every Blocking issue until each has a usable resolution', () => {
    expect(unresolvedBlocking(proposal.issues, [])).toEqual(blocking);
    const all: Resolution[] = blocking.map((i) => ({ issueId: i.id, action: 'remove' }));
    expect(unresolvedBlocking(proposal.issues, all)).toEqual([]);
  });

  it('does not count an empty replacement or keep-as-written on a Blocking issue', () => {
    const [first, second, ...rest] = blocking;
    const resolutions: Resolution[] = [
      { issueId: first!.id, action: 'replace', value: '  ' },
      { issueId: second!.id, action: 'accept' },
      ...rest.map((i) => ({ issueId: i.id, action: 'remove' as const })),
    ];
    expect(unresolvedBlocking(proposal.issues, resolutions).map((i) => i.id)).toEqual([
      first!.id,
      second!.id,
    ]);
  });
});

describe('applyToGroup', () => {
  it('gives every issue in the group the same resolution, replacing earlier ones', () => {
    const group = groupIssues(proposal.issues).find((g) => g.code === 'RL.6.9.a')!;
    const before: Resolution[] = [
      { issueId: 'L22.focusStandards.RL.6.9.a', action: 'remove' },
      { issueId: 'L4.focusStandards.6.2', action: 'accept-suggestion' },
    ];
    const after = applyToGroup(before, group, { action: 'replace', value: 'RL.6.9' });
    expect(after).toHaveLength(5);
    expect(after.filter((r) => r.action === 'replace').map((r) => r.issueId)).toEqual(
      group.issues.map((i) => i.id),
    );
    expect(after).toContainEqual({ issueId: 'L4.focusStandards.6.2', action: 'accept-suggestion' });
  });
});
