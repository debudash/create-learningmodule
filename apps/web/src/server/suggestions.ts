import {
  clientFromSettings,
  createFakeClient,
  DEFAULT_MODEL,
  llmSettingsFromEnv,
  placeholderSuggestion,
  type LlmClient,
  type SuggestionRequest,
} from '@lcg/generation';

// One live client per server process, surviving Next.js hot reloads in development.
const processCache = globalThis as unknown as { lcgSuggestionClient?: Promise<LlmClient | 'fake'> };

/**
 * The model behind an AI Suggestion (ADR 0005): live uses LLM_MODEL; fake returns
 * a labelled placeholder change; replay has no recordings of suggestions, so each
 * one is reported as unavailable.
 */
export async function suggestionClientFor(request: SuggestionRequest): Promise<LlmClient> {
  processCache.lcgSuggestionClient ??= clientFromSettings(llmSettingsFromEnv(process.env), process.env.LLM_MODEL ?? DEFAULT_MODEL, {
    replay: () => undefined,
  });
  const client = await processCache.lcgSuggestionClient;
  return client === 'fake' ? createFakeClient(() => JSON.stringify(placeholderSuggestion(request.activity, request.action))) : client;
}
