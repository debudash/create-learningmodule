import type { GenerationContext } from '@lcg/db';
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

/**
 * Chooses the model client from the environment (ADR 0005):
 * - live: the Anthropic API (LLM_MODEL, LLM_EFFORT); LLM_RECORD=true saves results for replay;
 *   LANGSMITH_TRACING=true adds tracing;
 * - replay (default): recorded results, no API key, no cost;
 * - fake: placeholder Lessons built from the Outline, for working offline.
 */
export async function modelsFromEnv(env = process.env): Promise<(context: GenerationContext) => LlmClient> {
  const mode = (env.LLM_MODE ?? 'replay') as LlmMode;
  if (mode === 'live') {
    const live = await createLiveClient({
      model: env.LLM_MODEL ?? 'claude-sonnet-5-5',
      effort: (env.LLM_EFFORT ?? 'medium') as Effort,
      tracing: env.LANGSMITH_TRACING === 'true',
      ...(env.LLM_RECORD === 'true' ? { onResult: (request, result) => writeRecording(request.key, result) } : {}),
    });
    return () => live;
  }
  if (mode === 'replay') {
    const replay = createReplayClient(replayLookup);
    return () => replay;
  }
  return (context) => createFakeClient(() => JSON.stringify(placeholderOutput(context.outline)));
}

/** A recording for this key, or for the first attempt when a later attempt was never recorded. */
function replayLookup(key: string): LlmResult | undefined {
  return (readRecording(key) ?? readRecording(key.replace(/\/attempt-\d+\//, '/attempt-1/'))) as LlmResult | undefined;
}
