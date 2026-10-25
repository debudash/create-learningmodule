import { createLiveClient, createReplayClient, type Effort, type LiveClientOptions, type LlmClient, type LlmResult } from './llm.js';

export type LlmMode = 'live' | 'replay' | 'fake';
const MODES: readonly LlmMode[] = ['live', 'replay', 'fake'];
const EFFORTS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

/** The models used when the environment names none (ADR 0005). */
export const DEFAULT_MODEL = 'claude-sonnet-5-5';
export const DEFAULT_REVIEW_MODEL = 'claude-haiku-5-5';

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

/**
 * The client for live or replay mode, or 'fake' for the caller to answer itself
 * (fake answers depend on what is asked). Live calls use `model`; replay serves
 * recordings from `replay`.
 */
export async function clientFromSettings(
  settings: LlmSettings,
  model: string,
  options: { replay: (key: string) => LlmResult | undefined; onResult?: LiveClientOptions['onResult'] },
): Promise<LlmClient | 'fake'> {
  if (settings.mode === 'fake') return 'fake';
  if (settings.mode === 'replay') return createReplayClient(options.replay);
  return createLiveClient({
    model,
    effort: settings.effort,
    tracing: settings.tracing,
    ...(settings.record && options.onResult ? { onResult: options.onResult } : {}),
  });
}
