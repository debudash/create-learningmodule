import { LESSON_TYPES, type LessonType } from '@lcg/lesson-schema';
import sources from '../data/example-sources.json' with { type: 'json' };
import texts from '../data/example-texts.json' with { type: 'json' };

/**
 * The few-shot example Lessons, one per Lesson Type, rendered from Newsela's published
 * Lessons in Units 1–3 by scripts/build-examples.ts. Published Unit 4 is the Answer Key and
 * never an example (ADR 0007). The build script also writes the rendered text into this
 * package's data, so prompts can include it without reading files.
 */

/** Every Lesson Type has an example. */
export const EXAMPLE_LESSON_TYPES: readonly LessonType[] = LESSON_TYPES;

/** Where one example came from. */
export interface ExampleSource {
  unit: number;
  lesson: number;
  /** The published Lesson's title, e.g. "Lesson 4: Hidden Figures, Prologue–Chapter 1". */
  title: string;
  /** The published Teacher View. */
  sourceUrl: string;
  /** The example's file in fixtures/examples/. */
  file: string;
}

const manifest = sources as Record<LessonType, ExampleSource>;

/** The source of each Lesson Type's example (the manifest the build script writes). */
export function exampleSources(): Record<LessonType, ExampleSource> {
  return Object.fromEntries(EXAMPLE_LESSON_TYPES.map((t) => [t, { ...manifest[t] }])) as Record<
    LessonType,
    ExampleSource
  >;
}

/** The rendered example Lesson (Teacher View as Markdown) for a Lesson Type. */
export function exampleMarkdown(lessonType: LessonType): string {
  return (texts as Record<LessonType, string>)[lessonType];
}
