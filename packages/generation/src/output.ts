import { lessonSchema } from '@lcg/lesson-schema';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/** A short summary of a generated Lesson that later Lessons in its Arc build on (GLOSSARY: Lesson Digest). */
export const lessonDigestSchema = z.object({
  summary: z.string(),
  keyActivities: z.array(z.string()),
  vocabularyTaught: z.array(z.string()),
  standardsCovered: z.array(z.string()),
});
export type LessonDigest = z.infer<typeof lessonDigestSchema>;

/** What one generation call returns: the Lesson and its Digest. */
export const generationOutputSchema = z.object({
  lesson: lessonSchema,
  digest: lessonDigestSchema,
});
export type GenerationOutput = z.infer<typeof generationOutputSchema>;

/** JSON Schema keywords structured outputs do not accept; our Zod schema checks them after. */
const UNSUPPORTED = new Set([
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'pattern',
  'default',
  '$schema',
]);

function sanitize(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitize);
  if (node && typeof node === 'object') {
    const entries = Object.entries(node as Record<string, unknown>)
      .filter(([key]) => !UNSUPPORTED.has(key))
      .map(([key, value]) => [key, sanitize(value)]);
    const result = Object.fromEntries(entries) as Record<string, unknown>;
    if (result.type === 'object') result.additionalProperties = false;
    return result;
  }
  return node;
}

/** A Zod schema as JSON Schema for structured outputs (constraints the API cannot enforce are removed). */
export function toOutputJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  return sanitize(zodToJsonSchema(schema, { $refStrategy: 'none' })) as Record<string, unknown>;
}

let jsonSchema: Record<string, unknown> | undefined;

/** The generation output as JSON Schema for structured outputs. */
export function generationOutputJsonSchema(): Record<string, unknown> {
  jsonSchema ??= toOutputJsonSchema(generationOutputSchema);
  return jsonSchema;
}
