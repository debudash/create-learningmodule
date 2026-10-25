import {
  createFakeClient,
  createLiveClient,
  createReplayClient,
  llmSettingsFromEnv,
  placeholderEdit,
  type EditRequest,
  type LlmClient,
} from '@lcg/generation';

// One live client per server process, surviving Next.js hot reloads in development.
const holder = globalThis as unknown as { lcgEditClient?: Promise<LlmClient> };

/**
 * The model behind an AI Suggestion (ADR 0005): live uses LLM_MODEL; fake returns
 * a labelled placeholder change; replay has no recordings of edits, so every
 * suggestion is reported as unavailable.
 */
export async function editClientFor(request: EditRequest): Promise<LlmClient> {
  const settings = llmSettingsFromEnv(process.env);
  if (settings.mode === 'fake') return createFakeClient(() => JSON.stringify(placeholderEdit(request.activity, request.action)));
  if (settings.mode === 'replay') return createReplayClient(() => undefined);
  holder.lcgEditClient ??= createLiveClient({
    model: process.env.LLM_MODEL ?? 'claude-sonnet-5-5',
    effort: settings.effort,
    tracing: settings.tracing,
  });
  return holder.lcgEditClient;
}
