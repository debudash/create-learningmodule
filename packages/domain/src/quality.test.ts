import type { Lesson } from '@lcg/lesson-schema';
import { sampleLesson } from '@lcg/lesson-schema/testing';
import { describe, expect, it } from 'vitest';
import { countChecks, runRuleChecks, type CheckId, type CheckOutlineFacts, type QualityCheckResult } from './quality.js';

const outline: CheckOutlineFacts = {
  focusStandards: ['L.6.4.b', 'RI.6.4'],
  vocabulary: ['modernization', 'transform', 'traditional', 'adapter'],
};

const resultsOf = (lesson: Lesson, checkId: CheckId, facts = outline) =>
  runRuleChecks(lesson, facts).filter((r) => r.checkId === checkId);

const withoutPulseChecks = (lesson: Lesson): Lesson => ({
  ...lesson,
  sections: lesson.sections.map((s) => ({
    ...s,
    activities: s.activities.map((a) => ({ ...a, blocks: a.blocks.filter((b) => b.type !== 'pulse-check') })),
  })),
});

describe('runRuleChecks', () => {
  it('passes the sample Spark Lesson except for one Activity without ELD support', () => {
    const notPassing = runRuleChecks(sampleLesson(), outline).filter((r) => r.outcome !== 'pass');
    expect(notPassing.map((r) => [r.checkId, r.outcome, r.location])).toEqual([['eld-support', 'warn', 'lia-part-b']]);
  });

  it('fails a Lesson missing a Section its Lesson Type needs', () => {
    const lesson = sampleLesson();
    lesson.sections = lesson.sections.filter((s) => s.kind !== 'look-back');
    expect(resultsOf(lesson, 'sections')).toMatchObject([{ outcome: 'fail', message: expect.stringMatching(/look-back/) }]);
  });

  it('passes pacing within 5 minutes of 50, fails beyond, and warns when a Section misses its target', () => {
    const long = sampleLesson();
    long.sections[0]!.activities[0]!.minutes = 20;
    expect(resultsOf(long, 'pacing')).toMatchObject([
      { outcome: 'fail', message: 'The Lesson runs 60 minutes; it should be 50.' },
    ]);
    const close = sampleLesson();
    close.sections[0]!.activities[0]!.minutes += 3;
    expect(resultsOf(close, 'pacing')).toMatchObject([{ outcome: 'pass', message: 'The Lesson runs 53 minutes; it should be 50.' }]);

    const shifted = sampleLesson();
    shifted.sections[0]!.activities[0]!.minutes = 7;
    shifted.sections[1]!.activities[0]!.minutes = 18;
    expect(resultsOf(shifted, 'pacing')).toMatchObject([{ outcome: 'pass' }]);
    expect(resultsOf(shifted, 'section-pacing')).toMatchObject([
      { outcome: 'warn', message: 'Launch runs 12 minutes; Spark Lessons give it 15.', location: shifted.sections[0]!.activities[0]!.id },
      { outcome: 'warn', message: 'Learning in Action runs 33 minutes; Spark Lessons give it 30.' },
    ]);
  });

  it('fails each Focus Standard that no Activity teaches, naming it', () => {
    const lesson = sampleLesson();
    for (const activity of lesson.sections.flatMap((s) => s.activities)) {
      activity.standards = activity.standards.filter((code) => code !== 'L.6.4.b');
    }
    expect(resultsOf(lesson, 'focus-standards-taught')).toMatchObject([
      { outcome: 'fail', message: 'No Activity is tagged with the Focus Standard L.6.4.b.', location: 'lia-part-a' },
    ]);
  });

  it("warns about Activity tags that are not among the Lesson's standards, pointing at the Activity", () => {
    const lesson = sampleLesson();
    lesson.sections[2]!.activities[0]!.standards.push('W.6.3');
    expect(resultsOf(lesson, 'known-standards')).toMatchObject([
      { outcome: 'warn', location: 'look-back-quick-write', message: expect.stringMatching(/W\.6\.3/) },
    ]);
  });

  it('fails a standard code that is not in the Grade 6 dataset', () => {
    const lesson = sampleLesson();
    lesson.header.supportingStandards.push('RL.6.99');
    expect(resultsOf(lesson, 'known-standards')).toMatchObject([
      { outcome: 'fail', message: 'RL.6.99 is not a Grade 6 standard code.' },
    ]);
  });

  it('warns about Outline vocabulary the Lesson does not define', () => {
    const lesson = sampleLesson();
    lesson.header.vocabulary = lesson.header.vocabulary.filter((v) => v.word !== 'transform');
    expect(resultsOf(lesson, 'vocabulary')).toMatchObject([{ outcome: 'warn', message: expect.stringMatching(/transform/) }]);
  });

  it('requires a Pulse Check in the Lesson Types whose examples have one', () => {
    expect(resultsOf(withoutPulseChecks(sampleLesson()), 'pulse-check')).toMatchObject([
      { outcome: 'fail', message: 'Spark Lessons need at least one Pulse Check.', location: 'lia-part-a' },
    ]);
    const reading = { ...sampleLesson(), lessonType: 'core-reading' as const };
    expect(resultsOf(withoutPulseChecks(reading), 'pulse-check')).toMatchObject([{ outcome: 'fail' }]);
    for (const lessonType of ['writing', 'flex-day'] as const) {
      const lesson = { ...withoutPulseChecks(sampleLesson()), lessonType };
      expect(resultsOf(lesson, 'pulse-check')).toMatchObject([{ outcome: 'pass', message: 'This Lesson Type needs no Pulse Check.' }]);
    }
  });

  it('warns about each Learning in Action Activity without ELD support', () => {
    expect(resultsOf(sampleLesson(), 'eld-support')).toMatchObject([
      { outcome: 'pass', location: 'lia-part-a' },
      { outcome: 'warn', location: 'lia-part-b', message: 'Part B: Old Story, New City has no Integrated ELD Instructions.' },
    ]);
  });

  it('checks a Flex Day against its own plan: 40 minutes of Huddles, each with ELD support', () => {
    const flex: Lesson = { ...sampleLesson(), lessonType: 'flex-day' };
    flex.sections = flex.sections.filter((s) => s.kind !== 'homework');
    for (const activity of flex.sections.find((s) => s.kind === 'learning-in-action')!.activities) activity.routine = 'Huddle';
    expect(resultsOf(flex, 'section-pacing')).toMatchObject([
      { outcome: 'warn', message: 'Launch runs 15 minutes; Flex Day Lessons give it 5.' },
      { outcome: 'warn', message: 'Learning in Action runs 30 minutes; Flex Day Lessons give it 40.' },
    ]);
    expect(resultsOf(flex, 'eld-support').map((r) => [r.location, r.outcome])).toEqual([
      ['lia-part-a', 'pass'],
      ['lia-part-b', 'warn'],
    ]);
  });

  it('fails when teacher-only text, such as a Pulse Check rationale, reaches the Student View', () => {
    const lesson = sampleLesson();
    const activity = lesson.sections.flatMap((s) => s.activities).find((a) => a.blocks.some((b) => b.type === 'pulse-check'))!;
    const pulse = activity.blocks.find((b) => b.type === 'pulse-check')!;
    if (pulse.type !== 'pulse-check') throw new Error('unreachable');
    activity.blocks.push({ type: 'directions', text: `Remember: ${pulse.choices[0]!.rationale}` });
    expect(resultsOf(lesson, 'student-view')).toMatchObject([{ outcome: 'fail', location: activity.id }]);
  });

  it('counts results as pass, warn and fail', () => {
    const results: QualityCheckResult[] = [
      { checkId: 'pacing', source: 'rule', outcome: 'pass', message: '' },
      { checkId: 'vocabulary', source: 'rule', outcome: 'warn', message: '' },
      { checkId: 'ai-standard', source: 'ai-review', outcome: 'fail', message: '' },
    ];
    expect(countChecks(results)).toEqual({ pass: 1, warn: 1, fail: 1 });
  });
});
