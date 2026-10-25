import type { ModelCall } from '@lcg/generation';

/** A model call as the columns every table of model calls shares (modelCallColumns in schema.ts). */
export function modelCallValues(call: ModelCall) {
  return {
    model: call.model,
    mode: call.mode,
    inputTokens: call.usage.inputTokens,
    outputTokens: call.usage.outputTokens,
    cacheReadTokens: call.usage.cacheReadTokens,
    cacheWriteTokens: call.usage.cacheWriteTokens,
    costUsd: call.costUsd.toFixed(4),
    durationMs: call.durationMs,
  };
}
