import { describe, expect, it } from 'vitest';
import { generationAllowance } from './generation-policy.js';

const limits = { approversOnly: true, dailyCap: 20 };

describe('generationAllowance', () => {
  it('never limits replayed or fake generation', () => {
    expect(generationAllowance({ role: 'editor', live: false, limits, generatedToday: 99, requested: 47 })).toEqual({
      ok: true,
    });
  });

  it('keeps live generation to Approvers when the demo says so', () => {
    const result = generationAllowance({ role: 'editor', live: true, limits, generatedToday: 0, requested: 3 });
    expect(result).toMatchObject({ ok: false, message: expect.stringMatching(/only Approvers/) });
    expect(generationAllowance({ role: 'approver', live: true, limits, generatedToday: 0, requested: 3 }).ok).toBe(true);
  });

  it('enforces the daily cap and says how many are left', () => {
    const result = generationAllowance({ role: 'approver', live: true, limits, generatedToday: 18, requested: 3 });
    expect(result).toEqual({ ok: false, message: 'This demo generates at most 20 Lessons a day; 2 are left today.' });
    expect(generationAllowance({ role: 'approver', live: true, limits, generatedToday: 17, requested: 3 }).ok).toBe(true);
  });

  it('has no limits locally', () => {
    expect(
      generationAllowance({ role: 'editor', live: true, limits: { approversOnly: false }, generatedToday: 500, requested: 47 }),
    ).toEqual({ ok: true });
  });
});
