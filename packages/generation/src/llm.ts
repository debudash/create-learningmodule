import Anthropic from '@anthropic-ai/sdk';
import { NO_USAGE, type TokenUsage } from './cost.js';

/** One structured call to the model. */
export interface LlmRequest {
  /** Stable name of this call for recording and replay, e.g. "g6-u4/L22/attempt-1". */
  key: string;
  system: Anthropic.Beta.BetaTextBlockParam[];
  messages: Anthropic.Beta.BetaMessageParam[];
  /** JSON Schema the reply must follow (structured outputs). */
  schema: Record<string, unknown>;
  maxTokens: number;
}

export interface LlmResult {
  /** The reply's text: JSON matching the schema, unless the call was refused or cut off. */
  text: string;
  model: string;
  stopReason: string | null;
  usage: TokenUsage;
  durationMs: number;
}

/** The model, live or stand-in (ADR 0005: live, replay and fake modes). */
export interface LlmClient {
  readonly mode: 'live' | 'replay' | 'fake';
  readonly model: string;
  complete(request: LlmRequest): Promise<LlmResult>;
}

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface LiveClientOptions {
  model: string;
  effort: Effort;
  /** Called with every result, so a real run can be saved for replay. */
  onResult?: (request: LlmRequest, result: LlmResult) => void | Promise<void>;
  /** Wraps the client for LangSmith tracing when enabled by environment. */
  tracing?: boolean;
}

/**
 * Calls Claude through the Anthropic SDK: streamed (long Lesson JSON), with
 * structured output, and with the server-side refusal fallback enabled, so a
 * request a safety classifier declines is retried on Anthropic's recommended model.
 */
export async function createLiveClient(options: LiveClientOptions): Promise<LlmClient> {
  let anthropic = new Anthropic();
  if (options.tracing) {
    const { wrapSDK } = await import('langsmith/wrappers');
    anthropic = wrapSDK(anthropic);
  }

  return {
    mode: 'live',
    model: options.model,
    async complete(request) {
      const started = Date.now();
      const stream = anthropic.beta.messages.stream({
        model: options.model,
        max_tokens: request.maxTokens,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: request.system,
        messages: request.messages,
        output_config: { effort: options.effort, format: { type: 'json_schema', schema: request.schema } },
      });
      const message = await stream.finalMessage();
      const result: LlmResult = {
        text: message.content
          .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
          .map((block) => block.text)
          .join(''),
        model: message.model,
        stopReason: message.stop_reason,
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
          cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
        },
        durationMs: Date.now() - started,
      };
      await options.onResult?.(request, result);
      return result;
    },
  };
}

/**
 * Serves recorded results by request key, at a realistic pace, so the whole flow
 * can be demonstrated without an API key or cost. Recorded usage is kept for
 * reporting, but replayed calls cost nothing.
 */
export function createReplayClient(
  lookup: (key: string) => LlmResult | undefined,
  { maxDelayMs = 4000 }: { maxDelayMs?: number } = {},
): LlmClient {
  return {
    mode: 'replay',
    model: 'replay',
    async complete(request) {
      const recorded = lookup(request.key);
      if (!recorded) throw new Error(`No recording for ${request.key}`);
      await new Promise((resolve) => setTimeout(resolve, Math.min(recorded.durationMs / 10, maxDelayMs)));
      return recorded;
    },
  };
}

/** Answers with a supplied function; for tests and for working offline with placeholder Lessons. */
export function createFakeClient(respond: (request: LlmRequest) => string): LlmClient {
  return {
    mode: 'fake',
    model: 'fake',
    async complete(request) {
      return { text: respond(request), model: 'fake', stopReason: 'end_turn', usage: NO_USAGE, durationMs: 0 };
    },
  };
}
