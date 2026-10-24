import { describe, expect, it } from 'vitest';
import { lessonToLines } from './lesson-text.js';
import { sampleLesson } from './testing.js';

describe('lessonToLines', () => {
  const lines = lessonToLines(sampleLesson());

  it('lists the header, then each Section and Activity with its blocks', () => {
    expect(lines[0]).toBe('Title: Rick Riordan as a Myth Adapter');
    expect(lines).toContain('## Launch');
    expect(lines).toContain('### Turn and Talk: Monsters in Manhattan (10 min; SL.6.1; Turn and Talk)');
    expect(lines.indexOf('## Launch')).toBeLessThan(lines.indexOf('## Look Back'));
  });

  it('labels teacher material and spells out Pulse Check answers', () => {
    expect(lines.some((l) => l.startsWith('Say: Imagine a Greek god'))).toBe(true);
    expect(lines.some((l) => l.startsWith('Sample response: Medusa'))).toBe(true);
    expect(lines).toContain('  B. to change a story into a new form (Correct: *Trans-* plus *form* means to change the form of something, which is what an adapter does.)');
  });
});
