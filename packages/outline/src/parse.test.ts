import { describe, expect, it } from 'vitest';
import { parseOutlineCsv } from './parse.js';
import { sampleOutlineCsv } from './testing.js';
import type { ImportProposal, OutlineLesson } from './types.js';

const SAMPLE = sampleOutlineCsv();

const proposal: ImportProposal = parseOutlineCsv(SAMPLE);

function lesson(key: string): OutlineLesson {
  const found = proposal.lessons.find((l) => l.key === key);
  if (!found) throw new Error(`no lesson ${key}`);
  return found;
}

const codes = (refs: { code: string }[]) => refs.map((r) => r.code);
const issuesOf = (kind: string) => proposal.issues.filter((i) => i.kind === kind);

describe('parseOutlineCsv: the sample Unit 4 Outline', () => {
  describe('row classification', () => {
    it('finds 41 Lessons and 6 Flex Days, 47 days in Outline order', () => {
      expect(proposal.lessons.filter((l) => l.lessonType !== 'flex-day')).toHaveLength(41);
      expect(proposal.lessons.filter((l) => l.lessonType === 'flex-day')).toHaveLength(6);
      expect(proposal.lessons.map((l) => l.position)).toEqual(
        Array.from({ length: 47 }, (_, i) => i + 1),
      );
      expect(proposal.statedDayTotal).toBe(47);
      expect(issuesOf('day-total-mismatch')).toEqual([]);
    });

    it('numbers Lessons from the Outline and keys Flex Days in order', () => {
      expect(lesson('L1').lessonNumber).toBe(1);
      expect(lesson('L41').lessonNumber).toBe(41);
      expect(proposal.lessons.filter((l) => l.lessonType === 'flex-day').map((l) => l.key)).toEqual([
        'F1',
        'F2',
        'F3',
        'F4',
        'F5',
        'F6',
      ]);
      expect(lesson('F1').lessonNumber).toBeUndefined();
    });

    it('finds the four Arcs with their descriptions', () => {
      expect(proposal.arcs.map((a) => a.name)).toEqual([
        'Spark',
        'Investigation 1',
        'Investigation 2',
        'Showcase',
      ]);
      expect(proposal.arcs.map((a) => a.position)).toEqual([1, 2, 3, 4]);
      const inv1 = proposal.arcs[1]!;
      expect(inv1.description).toContain('Core of the unit');
      expect(inv1.description).toContain('Across Lessons 4-19');
      expect(inv1.performanceTaskSkills).toContain('cross-text comparison');
      expect(inv1.flexDescription).toContain('Flexible days');
    });

    it('places every Lesson and Flex Day in its Arc', () => {
      const arcOf = (key: string) =>
        proposal.arcs.find((a) => a.key === lesson(key).arcKey)?.name;
      expect(arcOf('L3')).toBe('Spark');
      expect(arcOf('L4')).toBe('Investigation 1');
      expect(arcOf('F1')).toBe('Investigation 1');
      expect(arcOf('F2')).toBe('Investigation 1');
      expect(arcOf('L20')).toBe('Investigation 2');
      expect(arcOf('F4')).toBe('Investigation 2');
      expect(arcOf('L41')).toBe('Showcase');
      expect(arcOf('F6')).toBe('Showcase');
      expect(issuesOf('arc-mismatch')).toEqual([]);
    });
  });

  describe('Unit metadata', () => {
    it('reads grade, unit number and anchor text from the title row', () => {
      expect(proposal.unit).toMatchObject({
        grade: 6,
        unitNumber: 4,
        anchorText: { title: 'The Lightning Thief', author: 'Rick Riordan', isbn: '9780786838653' },
      });
    });

    it('reads the Performance Task name from the Showcase Lessons', () => {
      expect(proposal.unit.performanceTask).toBe('Shared Stories, Shared Lessons');
    });

    it('warns once that filenames say Unit 3 while the title says Unit 4', () => {
      const conflicts = issuesOf('metadata-conflict');
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toMatchObject({ severity: 'warning' });
      expect(conflicts[0]!.message).toMatch(/U3/);
    });

    it('warns about filenames that do not match their Lesson number', () => {
      expect(issuesOf('filename-mismatch').map((i) => i.lessonKey)).toEqual(['L35', 'L39']);
    });
  });

  describe('Lesson fields', () => {
    it('maps Lesson Types, including Spark numbers and double Lessons', () => {
      expect(lesson('L2')).toMatchObject({ lessonType: 'spark', outlineType: 'Spark 2' });
      expect(lesson('L4').lessonType).toBe('core-reading');
      expect(lesson('L5').lessonType).toBe('core-writing');
      expect(lesson('L19').lessonType).toBe('academic-discussion');
      expect(lesson('L23')).toMatchObject({ lessonType: 'core-writing', isDoubleLesson: true });
      expect(lesson('L36').lessonType).toBe('writing');
      expect(lesson('F1').lessonType).toBe('flex-day');
    });

    it('treats "N/A" questions as absent and reads Showcase learning goals', () => {
      expect(lesson('L3').textDependentQuestion).toBeUndefined();
      expect(lesson('L22').textDependentQuestion).toMatch(/^How does Riordan/);
      expect(lesson('L36').textDependentQuestion).toBeUndefined();
      expect(lesson('L36').learningGoals[0]).toMatch(/^Students will plan an explanatory essay/);
    });

    it('takes a heading from the first line of the description', () => {
      expect(lesson('L3').heading).toBe('Rick Riordan as a Myth Adapter');
      expect(lesson('F1').heading).toBe('Meaning-Making Huddle');
    });

    it('titles each Lesson by its heading, else by number', () => {
      expect(lesson('L3').title).toBe('Rick Riordan as a Myth Adapter');
      const untitled = proposal.lessons.find((l) => !l.heading);
      if (untitled) expect(untitled.title).toMatch(/^(Lesson \d+|Flex Day \d+)$/);
    });

    it('reads the focus pages named in the description', () => {
      expect(lesson('L22').focusPages).toEqual({ from: 224, to: 233 });
      expect(lesson('L4').focusPages).toEqual({ from: 1, to: 8 });
    });

    it('keeps every raw cell by column header', () => {
      expect(lesson('L4').rawCells['Focus Standards (assessed)']).toBe('RL.6.1, 6.2 L.6.4');
    });
  });

  describe('standards', () => {
    it('normalises and separates the four kinds of standard', () => {
      expect(codes(lesson('L3').focusStandards)).toEqual(['L.6.4.b', 'RI.6.4']);
      expect(codes(lesson('L3').supportingStandards)).toEqual(['SL.6.1']);
      expect(codes(lesson('L37').mediaLiteracyStandards)).toEqual(['MSLS.6.2.2.a']);
      expect(lesson('L3').eldStandards.map((e) => [e.code, e.description])).toEqual([
        ['ELD.PI.6.7', 'Analyze author purpose and message'],
        ['ELD.PI.6.6', 'Explain ideas using evidence'],
        ['ELD.PII.6.4', 'Produce expanded, connected explanations'],
      ]);
    });

    it('expands ranges into individual sub-standards', () => {
      expect(codes(lesson('L19').supportingStandards)).toEqual([
        'SL.6.1.a',
        'SL.6.1.b',
        'SL.6.1.c',
        'SL.6.1.d',
        'SL.6.6',
        'RL.6.9',
      ]);
      expect(codes(lesson('L39').supportingStandards)).toContain('L.6.2.b');
      expect(codes(lesson('L23').supportingStandards).slice(0, 5)).toEqual([
        'W.6.3.a',
        'W.6.3.b',
        'W.6.3.c',
        'W.6.3.d',
        'W.6.3.e',
      ]);
    });

    it('blocks on the stray "6.2" in Lesson 4 and suggests RL.6.2', () => {
      const malformed = issuesOf('malformed-standard');
      expect(malformed).toHaveLength(1);
      expect(malformed[0]).toMatchObject({
        severity: 'blocking',
        lessonKey: 'L4',
        field: 'focusStandards',
        raw: '6.2',
        suggestion: 'RL.6.2',
      });
      expect(codes(lesson('L4').focusStandards)).toEqual(['RL.6.1', '6.2', 'L.6.4']);
    });

    it('blocks on every use of the non-existent RL.6.9.a', () => {
      const unknown = issuesOf('unknown-standard');
      expect(unknown.map((i) => `${i.lessonKey}.${i.field}`)).toEqual([
        'L22.focusStandards',
        'L22.supportingStandards',
        'L26.supportingStandards',
        'L31.supportingStandards',
      ]);
      for (const issue of unknown) {
        expect(issue).toMatchObject({ severity: 'blocking', raw: 'RL.6.9.a', suggestion: 'RL.6.9' });
      }
    });

    it('warns when an ELD code does not match its description, with a suggestion', () => {
      const mismatch = issuesOf('eld-description-mismatch').find(
        (i) => i.lessonKey === 'L4' && i.raw?.includes('ELD.PII.6.5'),
      );
      expect(mismatch).toMatchObject({ severity: 'warning', field: 'eldStandards', suggestion: 'ELD.PII.6.2' });
      expect(mismatch!.message).toMatch(/Use transitions to connect ideas/);
    });

    it('flags exactly the nine ELD codes whose descriptions miss their official meaning', () => {
      // Seven mismatches found by research, plus PI.6.6, PII.6.4 and PII.6.6 uses the
      // matcher judged wrong (see eld-match.test.ts). Any new code here is a false positive.
      const flagged = new Set(issuesOf('eld-description-mismatch').map((i) => i.code));
      expect([...flagged].sort()).toEqual([
        'ELD.PI.6.2',
        'ELD.PI.6.4',
        'ELD.PI.6.5',
        'ELD.PI.6.6',
        'ELD.PII.6.1',
        'ELD.PII.6.3',
        'ELD.PII.6.4',
        'ELD.PII.6.5',
        'ELD.PII.6.6',
      ]);
      expect(issuesOf('eld-description-mismatch')).toHaveLength(37);
    });

    it('gives every issue a unique, stable id', () => {
      const ids = proposal.issues.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(parseOutlineCsv(SAMPLE).issues.map((i) => i.id)).toEqual(ids);
    });
  });

  describe('vocabulary and Designer Notes', () => {
    it('reads words with their page numbers', () => {
      expect(lesson('L22').vocabulary.slice(0, 2)).toEqual([
        { word: 'brutal', page: 225 },
        { word: 'sneer', page: 226 },
      ]);
    });

    it('reads comma-separated vocabulary lists', () => {
      expect(lesson('L20').vocabulary.map((v) => v.word)).toEqual([
        'confined',
        'vicious',
        'faithless',
        'plummeted',
        'Modernize',
        'Prowess',
        'Enraged',
        'Spectacle',
      ]);
    });

    it('keeps non-list lines in the vocabulary cell as Designer Notes, not words', () => {
      const l4 = lesson('L4');
      expect(l4.vocabulary).toHaveLength(10);
      expect(l4.designerNotes).toContain(
        '10 vocabulary words are taught, which is a lot for depth vocabulary words',
      );
    });

    it('reads unbulleted short lines as words, even after a bulleted first line', () => {
      expect(lesson('L3').vocabulary.map((v) => v.word)).toEqual([
        'modernization',
        'transform',
        'traditional',
        'adapt(er)',
      ]);
      expect(lesson('L3').designerNotes).toEqual([]);
    });
  });
});
