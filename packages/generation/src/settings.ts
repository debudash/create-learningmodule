import type { Effort } from './llm.js';

export type LlmMode = 'live' | 'replay' | 'fake';
const MODES: readonly LlmMode[] = ['live', 'replay', 'fake'];
const EFFORTS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

/** How the environment configures model calls (ADR 0005), shared by the worker and the web app. */
export interface LlmSettings {
  mode: LlmMode;
  effort: Effort;
  tracing: boolean;
  /** Save live results for replay. */
  record: boolean;
}

/** Reads one of a fixed set of values from the environment, refusing anything else. */
function choice<T extends string>(name: string, value: string | undefined, allowed: readonly T[], fallback: T): T {
  if (value === undefined || value === '') return fallback;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`${name} must be one of ${allowed.join(', ')}; got "${value}"`);
}

export function llmSettingsFromEnv(env: Record<string, string | undefined>): LlmSettings {
  return {
    mode: choice('LLM_MODE', env.LLM_MODE, MODES, 'replay'),
    effort: choice('LLM_EFFORT', env.LLM_EFFORT, EFFORTS, 'medium'),
    tracing: env.LANGSMITH_TRACING === 'true',
    record: env.LLM_RECORD === 'true',
  };
}
