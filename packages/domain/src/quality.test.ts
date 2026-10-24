import type { Lesson } from '@lcg/lesson-schema';
import { sampleLesson } from '@lcg/lesson-schema/testing';
import { describe, expect, it } from 'vitest';
import { runRuleChecks, summarizeChecks, type CheckOutlineFacts, type QualityCheckResult } from './quality.js';

const outline: CheckOutlineFacts = {
  focusStandards: ['L.6.4.b', 'RI.6.4'],
  vocabulary: ['modernization', 'transform', 'traditional', 'adapter'],
};

const outcomeOf = (lesson: Lesson, checkId: string, facts = outline) =>
  runRuleChecks(lesson, facts).filter((r) => r.checkId === checkId);

describe('runRuleChecks', () => {
  it('passes the sample Lesson except for one Activity without ELD support', () => {
    const notPassing = runRuleChecks(sampleLesson(), outline).filter((r) => r.outcome !== 'pass');
    expect(notPassing.map((r) => [r.checkId, r.outcome, r.location])).toEqual([['eld-support', 'warn', 'lia-part-b']]);
  });

  it('fails pacing that is more than 5 minutes off 50, and warns when a Section misses its target', () => {
    const long = sampleLesson();
    long.sections[0]!.activities[0]!.minutes = 20;
    expect(outcomeOf(long, 'pacing')).toMatchObject([
      { outcome: 'fail', message: 'The Lesson runs 60 minutes; it should be 50.' },
    ]);
    const shifted = sampleLesson();
    shifted.sections[0]!.activities[0]!.minutes = 7;
    shifted.sections[1]!.activities[0]!.minutes = 18;
    expect(outcomeOf(shifted, 'pacing')).toMatchObject([{ outcome: 'pass' }]);
    expect(outcomeOf(shifted, 'section-pacing')).toMatchObject([
      { outcome: 'warn', message: 'Launch runs 12 minutes; Spark Lessons give it 15.' },
      { outcome: 'warn', message: 'Learning in Action runs 33 minutes; Spark Lessons give it 30.' },
    ]);
  });

  it('fails each Focus Standard that no Activity teaches, naming it', () => {
    const lesson = sampleLesson();
    for (const activity of lesson.sections.flatMap((s) => s.activities)) {
      activity.standards = activity.standards.filter((code) => code !== 'L.6.4.b');
    }
    expect(outcomeOf(lesson, 'focus-standards-taught')).toMatchObject([
      { outcome: 'fail', message: 'No Activity is tagged with the Focus Standard L.6.4.b.' },
    ]);
  });

  it('warns about Activity tags that are not among the Lesson\'s standards, pointing at the Activity', () => {
    const lesson = sampleLesson();
    lesson.sections[2]!.activities[0]!.standards.push('W.6.3');
    expect(outcomeOf(lesson, 'known-standards')).toMatchObject([
      { outcome: 'warn', location: 'look-back-quick-write', message: expect.stringMatching(/W\.6\.3/) },
    ]);
  });

  it('warns about Outline vocabulary the Lesson does not define', () => {
    const lesson = sampleLesson();
    lesson.header.vocabulary = lesson.header.vocabulary.filter((v) => v.word !== 'transform');
    expect(outcomeOf(lesson, 'vocabulary')).toMatchObject([{ outcome: 'warn', message: expect.stringMatching(/transform/) }]);
  });

  it('requires a Pulse Check in Reading Lessons only', () => {
    const reading = { ...sampleLesson(), lessonType: 'core-reading' as const };
    const noPulse = (lesson: Lesson): Lesson => ({
      ...lesson,
      sections: lesson.sections.map((s) => ({
        ...s,
        activities: s.activities.map((a) => ({ ...a, blocks: a.blocks.filter((b) => b.type !== 'pulse-check') })),
      })),
    });
    expect(outcomeOf(noPulse(reading), 'pulse-check')).toMatchObject([{ outcome: 'fail' }]);
    expect(outcomeOf(noPulse(sampleLesson()), 'pulse-check')).toMatchObject([{ outcome: 'pass' }]);
  });

  it('warns about each Learning in Action Activity without ELD support', () => {
    expect(outcomeOf(sampleLesson(), 'eld-support')).toMatchObject([
      { outcome: 'pass', location: 'lia-part-a' },
      { outcome: 'warn', location: 'lia-part-b', message: 'Part B: Old Story, New City has no Integrated ELD Instructions.' },
    ]);
  });

  it('summarizes results as pass, warn and fail counts with the worst outcome', () => {
    const results: QualityCheckResult[] = [
      { checkId: 'a', source: 'rule', outcome: 'pass', message: '' },
      { checkId: 'b', source: 'rule', outcome: 'warn', message: '' },
      { checkId: 'c', source: 'rule', outcome: 'fail', message: '' },
    ];
    expect(summarizeChecks(results)).toEqual({ pass: 1, warn: 1, fail: 1, worst: 'fail' });
  });
});
