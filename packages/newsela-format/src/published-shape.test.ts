import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sampleLesson } from '@lcg/lesson-schema/testing';
import { toNewselaLesson, type NewselaNode } from './index.js';

/**
 * Compares our output with one real published lesson object (Unit 2, Lesson 2, a Spark Lesson).
 * Only Units 1-3 may be used: published Unit 4 is the Answer Key (ADR 0007).
 */
const SOURCE = fileURLToPath(
  new URL('../../../docs/source/example-lessons/unit2_all/u2_lesson02_data.json', import.meta.url),
);

interface Published {
  breadcrumbs: { teacher: { label: string }[] };
  sections: { teacher: { body: NewselaNode | null }[]; student: { body: NewselaNode | null }[] };
}

function readPublished(): Published & Record<string, unknown> {
  const data = JSON.parse(readFileSync(SOURCE, 'utf8')) as {
    queries: { state: { data: unknown } }[];
  };
  const found = data.queries
    .map((q) => q.state.data as (Published & Record<string, unknown>) | null)
    .find((d) => d && d.sections);
  if (!found) throw new Error(`no lesson object in ${SOURCE}`);
  return found;
}

/** Every node type (and mark type) under these nodes. */
function typesIn(nodes: (NewselaNode | null)[], into = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (!node) continue;
    into.add(node.type);
    for (const mark of node.marks ?? []) into.add(`mark:${mark.type}`);
    typesIn(node.content ?? [], into);
  }
  return into;
}

describe('toNewselaLesson against a published lesson object', () => {
  const published = readPublished();
  const { lesson, unmapped } = toNewselaLesson(sampleLesson(), { lessonNumber: 3 });

  it('reads a Units 1-3 Lesson, never the Answer Key', () => {
    expect(published.breadcrumbs.teacher.map((b) => b.label)).toContain('Unit 2');
  });

  it('has the same top-level keys, minus the ones listed as unmapped', () => {
    const unmappedKeys = new Set(unmapped.map((u) => u.split(':')[0]));
    const expected = Object.keys(published).filter((k) => !unmappedKeys.has(k));
    expect(Object.keys(lesson).sort()).toEqual(expected.sort());
  });

  it('uses only node and mark types that appear in the published data', () => {
    const theirs = typesIn(
      [...published.sections.teacher, ...published.sections.student].map((s) => s.body),
    );
    const ours = typesIn(
      [...lesson.sections.teacher, ...lesson.sections.student].map((s) => s.body),
    );
    expect([...ours].filter((t) => !theirs.has(t))).toEqual([]);
  });
});
