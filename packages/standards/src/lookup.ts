import dataset from '../data/standards.grade6.json' with { type: 'json' };
import type { Framework, Standard } from './types.js';

// The dataset is built by scripts/build-standards.ts and loaded once, at import.
// Entries are frozen so a caller cannot change the official text for everyone else.
const standards: readonly Standard[] = (dataset.standards as Standard[]).map((s) =>
  Object.freeze({
    ...s,
    children: Object.freeze([...s.children]) as string[],
    ...(s.levels ? { levels: Object.freeze({ ...s.levels }) } : {}),
  }),
);
const byCode = new Map(standards.map((s) => [s.code, s]));

/** The standard with this canonical code (see normalizeCode), or undefined. */
export function getStandard(code: string): Standard | undefined {
  return byCode.get(code);
}

/** Whether a standard with this canonical code exists. */
export function hasStandard(code: string): boolean {
  return byCode.has(code);
}

/** All standards in document order, optionally only those of one framework. */
export function listStandards(framework?: Framework): Standard[] {
  return framework ? standards.filter((s) => s.framework === framework) : [...standards];
}
