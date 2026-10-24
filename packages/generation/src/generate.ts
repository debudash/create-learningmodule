import type { Lesson } from '@lcg/lesson-schema';
import type { OutlineLesson } from '@lcg/outline';
import { addUsage, costOf, NO_USAGE, type TokenUsage } from './cost.js';
import type { LlmClient, LlmResult } from './llm.js';
import {
  generationOutputJsonSchema,
  generationOutputSchema,
  type GenerationOutput,
  type LessonDigest,
} from './output.js';
import { buildLessonPrompt, PROMPT_VERSION, type LessonPromptInput } from './prompt.js';

/** Room for a full Lesson as JSON plus the model's thinking. */
const MAX_TOKENS = 48_000;

export type GenerationOutcome = 'succeeded' | 'repaired' | 'failed';

/** What a Generation Attempt records (GLOSSARY: Generation Attempt). */
export interface GenerationRecord {
  outcome: GenerationOutcome;
  model: string;
  mode: LlmClient['mode'];
  promptVersion: number;
  usage: TokenUsage;
  costUsd: number;
  durationMs: number;
  /** Why the attempt failed, in words a person can act on. */
  failureReason?: string;
  /** Where the output broke the Lesson schema on its last try. */
  schemaViolations?: string[];
  rawOutput?: string;
}

export type GenerationResult =
  | { ok: true; lesson: Lesson; digest: LessonDigest; record: GenerationRecord }
  | { ok: false; record: GenerationRecord };

/**
 * Generates one Lesson: one structured call, validated against the Lesson schema,
 * and at most one repair call when the output does not validate (ADR 0005).
 */
export async function generateLesson(
  client: LlmClient,
  input: LessonPromptInput,
  key: string,
): Promise<GenerationResult> {
  const prompt = buildLessonPrompt(input);
  const schema = generationOutputJsonSchema();
  let usage = NO_USAGE;
  let durationMs = 0;
  const record = (outcome: GenerationOutcome, extra: Partial<GenerationRecord> = {}): GenerationRecord => ({
    outcome,
    model: client.model,
    mode: client.mode,
    promptVersion: PROMPT_VERSION,
    usage,
    costUsd: costOf(client.model, usage),
    durationMs,
    ...extra,
  });
  const track = (result: LlmResult) => {
    usage = addUsage(usage, result.usage);
    durationMs += result.durationMs;
  };

  const first = await client.complete({
    key: `${key}/first`,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
    schema,
    maxTokens: MAX_TOKENS,
  });
  track(first);
  const refused = stopProblem(first);
  if (refused) return { ok: false, record: record('failed', { failureReason: refused, rawOutput: first.text }) };

  const checked = check(first.text, input.lesson);
  if (checked.ok) return { ok: true, ...checked.output, record: record('succeeded') };

  const repair = await client.complete({
    key: `${key}/repair`,
    system: prompt.system,
    messages: [
      { role: 'user', content: prompt.user },
      { role: 'assistant', content: first.text },
      {
        role: 'user',
        content: `That Lesson does not pass validation:\n${checked.problems.map((p) => `- ${p}`).join('\n')}\n\nReturn the complete corrected JSON.`,
      },
    ],
    schema,
    maxTokens: MAX_TOKENS,
  });
  track(repair);
  const repairRefused = stopProblem(repair);
  if (repairRefused) {
    return { ok: false, record: record('failed', { failureReason: repairRefused, rawOutput: repair.text }) };
  }
  const rechecked = check(repair.text, input.lesson);
  if (rechecked.ok) return { ok: true, ...rechecked.output, record: record('repaired') };
  return {
    ok: false,
    record: record('failed', {
      failureReason: 'The generated Lesson did not pass validation, even after one repair.',
      schemaViolations: rechecked.problems,
      rawOutput: repair.text,
    }),
  };
}

function stopProblem(result: LlmResult): string | undefined {
  if (result.stopReason === 'refusal') return 'The model declined to write this Lesson.';
  if (result.stopReason === 'max_tokens') return 'The Lesson was cut off before it was finished.';
  return undefined;
}

type Checked = { ok: true; output: GenerationOutput } | { ok: false; problems: string[] };

/** Parses and validates the model's output, keeping the Outline's standards and Lesson Type authoritative. */
function check(text: string, outline: OutlineLesson): Checked {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, problems: ['The output is not valid JSON.'] };
  }
  const withOutline = applyOutline(parsed, outline);
  const result = generationOutputSchema.safeParse(withOutline);
  if (result.success) return { ok: true, output: result.data };
  return { ok: false, problems: result.error.issues.map((i) => `${i.path.join('.') || 'output'}: ${i.message}`) };
}

/** The Outline decides the Lesson Type and the standards lists; the model writes everything else. */
function applyOutline(parsed: unknown, outline: OutlineLesson): unknown {
  if (!parsed || typeof parsed !== 'object' || !('lesson' in parsed)) return parsed;
  const lesson = (parsed as { lesson: Record<string, unknown> }).lesson;
  if (!lesson || typeof lesson !== 'object') return parsed;
  const codes = (refs: { code: string }[]) => refs.map((r) => r.code);
  const header = (lesson.header ?? {}) as Record<string, unknown>;
  return {
    ...parsed,
    lesson: {
      ...lesson,
      schemaVersion: 1,
      lessonType: outline.lessonType,
      header: {
        ...header,
        focusStandards: codes(outline.focusStandards),
        supportingStandards: codes(outline.supportingStandards),
        eldStandards: codes(outline.eldStandards),
        mediaLiteracyStandards: codes(outline.mediaLiteracyStandards),
      },
    },
  };
}
