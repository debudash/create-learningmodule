import { describe, expect, it } from 'vitest';
import { publishability } from './release.js';

describe('publishability', () => {
  it('allows publishing when every Lesson is Approved', () => {
    expect(
      publishability([
        { key: 'L1', status: 'approved' },
        { key: 'F1', status: 'approved' },
      ]),
    ).toEqual({ ok: true });
  });

  it('names the Lessons holding the Unit back, grouped by status', () => {
    const result = publishability([
      { key: 'L1', status: 'approved' },
      { key: 'L2', status: 'in-review' },
      { key: 'L3', status: 'draft' },
      { key: 'L4', status: 'in-review' },
    ]);
    expect(result).toEqual({
      ok: false,
      waiting: { 'in-review': ['L2', 'L4'], draft: ['L3'] },
      message: '3 Lessons are not Approved yet: In Review L2, L4; Draft L3.',
    });
  });

  it('refuses a Unit with no Lessons', () => {
    expect(publishability([])).toMatchObject({ ok: false, message: 'This Unit has no Lessons.' });
  });
});
