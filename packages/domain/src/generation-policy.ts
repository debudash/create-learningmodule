import type { Role } from './vocabulary.js';

/** How many Lessons "Generate 3 to try" generates. */
export const TRIAL_BATCH_SIZE = 3;

/** Limits on live (paid) generation, for the hosted demo (PRD story 56). */
export interface LiveGenerationLimits {
  /** Only Approvers may start live generation. */
  approversOnly: boolean;
  /** At most this many Lessons a day; undefined means no cap. */
  dailyCap?: number;
}

export type Allowance = { ok: true } | { ok: false; message: string };

/**
 * Whether a person may start generating `requested` Lessons now. Replayed and fake
 * generation cost nothing and are never limited.
 */
export function generationAllowance(input: {
  role: Role;
  live: boolean;
  limits: LiveGenerationLimits;
  /** Lessons already sent for live generation today. */
  generatedToday: number;
  requested: number;
}): Allowance {
  const { role, live, limits, generatedToday, requested } = input;
  if (!live) return { ok: true };
  if (limits.approversOnly && role !== 'approver') {
    return { ok: false, message: 'On this demo, only Approvers can start generation with the live model.' };
  }
  if (limits.dailyCap !== undefined && generatedToday + requested > limits.dailyCap) {
    const left = Math.max(limits.dailyCap - generatedToday, 0);
    return {
      ok: false,
      message: `This demo generates at most ${limits.dailyCap} Lessons a day; ${left} ${left === 1 ? 'is' : 'are'} left today.`,
    };
  }
  return { ok: true };
}
