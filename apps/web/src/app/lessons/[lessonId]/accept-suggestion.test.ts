import { describe, expect, it, vi } from 'vitest';
import { acceptSuggestion } from './accept-suggestion';

const steps = (overrides: Partial<Parameters<typeof acceptSuggestion>[0]> = {}) => ({
  apply: vi.fn(() => ({ ok: true as const })),
  record: vi.fn(async () => ({ ok: true as const })),
  undo: vi.fn(),
  ...overrides,
});

describe('acceptSuggestion', () => {
  it('applies the change, then records it', async () => {
    const order: string[] = [];
    const s = steps({
      apply: () => (order.push('apply'), { ok: true as const }),
      record: async () => (order.push('record'), { ok: true as const }),
    });
    expect(await acceptSuggestion(s)).toEqual({ ok: true });
    expect(order).toEqual(['apply', 'record']);
    expect(s.undo).not.toHaveBeenCalled();
  });

  // LCG-26, found by the Phase 6 spec review: History listed accepted suggestions that never reached the Lesson.
  it('LCG-26: records nothing when the change could not be applied', async () => {
    const s = steps({ apply: vi.fn(() => ({ ok: false as const, reason: 'changed' as const })) });
    expect(await acceptSuggestion(s)).toMatchObject({ ok: false, message: expect.stringMatching(/changed/) });
    expect(s.record).not.toHaveBeenCalled();
  });

  it('LCG-26: takes the change back out when the server refuses to record it', async () => {
    const s = steps({ record: vi.fn(async () => ({ ok: false as const, message: 'The Lesson is Approved.' })) });
    expect(await acceptSuggestion(s)).toEqual({ ok: false, message: 'The Lesson is Approved.' });
    expect(s.undo).toHaveBeenCalledOnce();
  });
});
