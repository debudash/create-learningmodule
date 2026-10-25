import type { GenerationContext, ReviewContext } from '@lcg/db';
import { readRecording, writeRecording } from '@lcg/fixtures';
import {
  createFakeClient,
  createLiveClient,
  createReplayClient,
  llmSettingsFromEnv,
  placeholderOutput,
  type LlmClient,
  type LlmResult,
} from '@lcg/generation';

/** The mode, and a live client for a model, as the environment configures them (ADR 0005). */
async function liveOrReplay(env: NodeJS.ProcessEnv, model: string): Promise<LlmClient | 'fake'> {
  const settings = llmSettingsFromEnv(env);
  if (settings.mode === 'fake') return 'fake';
  if (settings.mode === 'replay') return createReplayClient(replayLookup);
  return createLiveClient({
    model,
    effort: settings.effort,
    tracing: settings.tracing,
    ...(settings.record ? { onResult: (request, result) => writeRecording(request.key, result) } : {}),
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
