import type { GenerationContext, ReviewContext } from '@lcg/db';
import { readRecording, writeRecording } from '@lcg/fixtures';
import {
  createFakeClient,
  createLiveClient,
  createReplayClient,
  placeholderOutput,
  type Effort,
  type LlmClient,
  type LlmResult,
} from '@lcg/generation';

export type LlmMode = 'live' | 'replay' | 'fake';
const MODES: readonly LlmMode[] = ['live', 'replay', 'fake'];
const EFFORTS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

/** Reads one of a fixed set of values from the environment, refusing anything else. */
function choice<T extends string>(name: string, value: string | undefined, allowed: readonly T[], fallback: T): T {
  if (value === undefined || value === '') return fallback;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`${name} must be one of ${allowed.join(', ')}; got "${value}"`);
}

/** The mode, and a live client for a model, as the environment configures them (ADR 0005). */
async function liveOrReplay(env: NodeJS.ProcessEnv, model: string): Promise<LlmClient | 'fake'> {
  const mode = choice('LLM_MODE', env.LLM_MODE, MODES, 'replay');
  if (mode === 'fake') return 'fake';
  if (mode === 'replay') return createReplayClient(replayLookup);
  return createLiveClient({
    model,
    effort: choice('LLM_EFFORT', env.LLM_EFFORT, EFFORTS, 'medium'),
    tracing: env.LANGSMITH_TRACING === 'true',
    ...(env.LLM_RECORD === 'true' ? { onResult: (request, result) => writeRecording(request.key, result) } : {}),
  });
}

/**
 * Chooses the model client from the environment (ADR 0005):
 * - live: the Anthropic API (LLM_MODEL, LLM_EFFORT); LLM_RECORD=true saves results for replay;
 *   LANGSMITH_TRACING=true adds tracing;
 * - replay (default): recorded results, no API key, no cost;
 * - fake: placeholder Lessons built from the Outline, for working offline.
 */
export async function modelsFromEnv(env = process.env): Promise<(context: GenerationContext) => LlmClient> {
  const client = await liveOrReplay(env, env.LLM_MODEL ?? 'claude-sonnet-5-5');
  if (client !== 'fake') return () => client;
  return (context) => createFakeClient(() => JSON.stringify(placeholderOutput(context.outline)));
}

/** A recording for this key, or for the first attempt when a later attempt was never recorded. */
function replayLookup(key: string): LlmResult | undefined {
  return (readRecording(key) ?? readRecording(key.replace(/\/attempt-\d+\//, '/attempt-1/'))) as LlmResult | undefined;
}

/**
 * Chooses the AI Review's model from the environment: live uses LLM_REVIEW_MODEL
 * (a cheaper model by default), replay serves recorded reviews, and fake answers
 * "taught" for every Focus Standard.
 */
export async function reviewModelsFromEnv(env = process.env): Promise<(context: ReviewContext) => LlmClient> {
  const client = await liveOrReplay(env, env.LLM_REVIEW_MODEL ?? 'claude-haiku-5-5');
  if (client !== 'fake') return () => client;
  return (context) =>
    createFakeClient(() =>
      JSON.stringify({
        standards: context.outline.focusStandards.map((s) => ({ code: s.code, verdict: 'taught', reason: '(fake review)' })),
        anchorText: { verdict: 'uses', reason: '(fake review)' },
      }),
    );
}
