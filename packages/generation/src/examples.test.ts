import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LESSON_TYPES } from '@lcg/lesson-schema';
import { exampleLessonMarkdown, exampleManifest } from '@lcg/fixtures';
import { EXAMPLE_LESSON_TYPES, exampleMarkdown, exampleSources } from './examples.js';

const sources = exampleSources();

/** Titles of the published Unit 4 Lessons (the Answer Key), read here and nowhere else. */
function unit4Titles(): string[] {
  const dir = fileURLToPath(
    new URL('../../../docs/source/example-lessons/unit4_all/', import.meta.url),
  );
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const data = JSON.parse(readFileSync(dir + f, 'utf8')) as {
        queries: { state: { data: { title?: string; sections?: unknown } | null } }[];
      };
      const lesson = data.queries.map((q) => q.state.data).find((d) => d?.sections);
      if (!lesson?.title) throw new Error(`no lesson title in ${f}`);
      // "Lesson 4: <name>": the Lesson number alone is shared with Units 1-3, so match the name.
      return lesson.title.replace(/^Lesson \d+:\s*/, '');
    });
}

describe('example Lessons', () => {
  it('has an example for every Lesson Type', () => {
    expect([...EXAMPLE_LESSON_TYPES].sort()).toEqual([...LESSON_TYPES].sort());
    for (const type of LESSON_TYPES) expect(sources[type]).toBeDefined();
  });

  // ADR 0007: published Unit 4 is the Answer Key, so examples come only from Units 1-3.
  it('draws every example from Units 1-3', () => {
    for (const source of Object.values(sources)) expect([1, 2, 3]).toContain(source.unit);
  });

  it('matches the manifest written next to the example files', () => {
    expect(exampleManifest()).toEqual(sources);
  });

  it('has a non-empty example file for every Lesson Type', () => {
    for (const type of LESSON_TYPES) {
      expect(sources[type].file).toBe(`${type}.md`);
      expect(exampleLessonMarkdown(type).trim().length).toBeGreaterThan(1000);
    }
  });

  // ADR 0007: no Answer Key material may reach a prompt, so no example names a Unit 4 Lesson.
  it('contains no published Unit 4 Lesson title', () => {
    const titles = unit4Titles();
    expect(titles).toHaveLength(45);
    for (const type of LESSON_TYPES) {
      const markdown = exampleLessonMarkdown(type);
      for (const title of titles)
        expect(markdown, `${type}.md names "${title}"`).not.toContain(title);
    }
  });
});

describe('exampleMarkdown', () => {
  it('serves the same text as the rendered example files', () => {
    for (const type of EXAMPLE_LESSON_TYPES) expect(exampleMarkdown(type)).toBe(exampleLessonMarkdown(type));
  });
});
