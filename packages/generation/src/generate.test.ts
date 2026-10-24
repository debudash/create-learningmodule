import { sampleOutlineCsv } from '@lcg/fixtures';
import { sampleLesson } from '@lcg/lesson-schema/testing';
import { confirmImport, parseOutlineCsv, type OutlineLesson, type Resolution } from '@lcg/outline';
import { describe, expect, it } from 'vitest';
import { generateLesson } from './generate.js';
import Anthropic from '@anthropic-ai/sdk';
import { createFakeClient, type LlmClient, type LlmRequest, type LlmResult } from './llm.js';
import { generationOutputJsonSchema } from './output.js';
import { placeholderOutput } from './placeholder.js';
import { buildLessonPrompt, LOCKED_INSTRUCTIONS, type LessonPromptInput } from './prompt.js';

const confirmed = (() => {
  const proposal = parseOutlineCsv(sampleOutlineCsv());
  const resolutions: Resolution[] = proposal.issues
    .filter((i) => i.severity === 'blocking')
    .map((i) => ({ issueId: i.id, action: 'accept-suggestion' }));
  const result = confirmImport(proposal, resolutions);
  if (!result.ok) throw new Error('sample did not confirm');
  return result.confirmed;
})();
const lesson = (key: string): OutlineLesson => confirmed.lessons.find((l) => l.key === key)!;

function input(key: string, extra: Partial<LessonPromptInput> = {}): LessonPromptInput {
  const row = lesson(key);
  const index = confirmed.lessons.indexOf(row);
  return {
    unit: confirmed.unit,
    arcs: confirmed.arcs,
    arcName: confirmed.arcs.find((a) => a.key === row.arcKey)!.name,
    lesson: row,
    previous: confirmed.lessons[index - 1],
    next: confirmed.lessons[index + 1],
    guidance: 'Keep Launch activities playful.',
    example: { lessonType: row.lessonType, markdown: 'EXAMPLE LESSON BODY' },
    ...extra,
  };
}

describe('buildLessonPrompt', () => {
  const prompt = buildLessonPrompt(input('L22'));
  const system = prompt.system.map((b) => b.text).join('\n');

  it('orders the prompt for caching: locked, Unit, example, then the Lesson', () => {
    expect(prompt.system[0]!.text).toBe(LOCKED_INSTRUCTIONS);
    expect(prompt.system[1]!.text).toContain('Keep Launch activities playful.');
    expect(prompt.system[1]).toHaveProperty('cache_control');
    expect(prompt.system[2]!.text).toContain('EXAMPLE LESSON BODY');
    expect(prompt.system[2]).toHaveProperty('cache_control');
    expect(system).not.toContain('Chapter 15');
  });

  it('gives the Lesson its Outline row, neighbours and the official text of its standards', () => {
    expect(prompt.user).toContain('Chapter 15');
    expect(prompt.user).toContain('Previous Lesson (L21');
    expect(prompt.user).toContain('Next Lesson (L23');
    expect(prompt.user).toMatch(/RL\.6\.9: Compare and contrast/);
    expect(prompt.user).toMatch(/ELD\.PI\.6\.7: .+\n {2}Emerging: /);
    expect(prompt.user).toContain('brutal (p. 225)');
    expect(prompt.user).toContain('Learning in Action (kind "learning-in-action"): 30 minutes');
  });

  it('puts Outline text inside data tags', () => {
    expect(prompt.user).toMatch(/<outline_row>[\s\S]*Chapter 15[\s\S]*<\/outline_row>/);
  });

  it('gives a Flex Day the Digests of its Arc and the Huddle structure', () => {
    const flex = buildLessonPrompt(
      input('F1', {
        digests: [
          {
            key: 'L4',
            title: 'Meeting Percy',
            digest: { summary: 'Students met Percy.', keyActivities: [], vocabularyTaught: ['envy'], standardsCovered: ['RL.6.1'] },
          },
        ],
      }),
    );
    expect(flex.user).toContain('L4 Meeting Percy: Students met Percy. Vocabulary: envy.');
    expect(flex.user).toContain('routine "Huddle"');
  });

  it('includes an Editor\'s one-off instructions when regenerating', () => {
    expect(buildLessonPrompt(input('L22', { extraInstructions: 'Use Ares, not Aphrodite.' })).user).toContain(
      'Use Ares, not Aphrodite.',
    );
  });
});

describe('generationOutputJsonSchema', () => {
  it('only uses keywords structured outputs accept, with closed objects', () => {
    const text = JSON.stringify(generationOutputJsonSchema());
    for (const keyword of ['minLength', 'minItems', 'maxItems', 'minimum', 'maximum', '$schema']) {
      expect(text).not.toContain(`"${keyword}"`);
    }
    const objects = text.match(/"type":"object"/g)!.length;
    expect(text.match(/"additionalProperties":false/g)!.length).toBe(objects);
  });
});

describe('generateLesson', () => {
  const valid = JSON.stringify({ lesson: sampleLesson(), digest: placeholderOutput(lesson('L3')).digest });

  function client(replies: string[]) {
    const calls: LlmRequest[] = [];
    return {
      calls,
      client: createFakeClient((request) => {
        calls.push(request);
        return replies[calls.length - 1] ?? '';
      }),
    };
  }

  it('succeeds on a valid first answer, with one call', async () => {
    const { calls, client: fake } = client([valid]);
    const result = await generateLesson(fake, input('L3'), 'u4/L3');
    expect(result.ok).toBe(true);
    expect(result.record.outcome).toBe('succeeded');
    expect(calls.map((c) => c.key)).toEqual(['u4/L3/first']);
  });

  it('repairs once, telling the model what was wrong', async () => {
    const broken = JSON.stringify({ lesson: { ...sampleLesson(), sections: [] }, digest: {} });
    const { calls, client: fake } = client([broken, valid]);
    const result = await generateLesson(fake, input('L3'), 'u4/L3');
    expect(result).toMatchObject({ ok: true, record: { outcome: 'repaired' } });
    expect(calls).toHaveLength(2);
    expect(calls[1]!.messages.at(-1)!.content).toMatch(/does not match the Lesson schema[\s\S]*sections/);
  });

  it('gives up after one failed repair and says why', async () => {
    const { calls, client: fake } = client(['not json', 'still not json']);
    const result = await generateLesson(fake, input('L3'), 'u4/L3');
    expect(calls).toHaveLength(2);
    expect(result).toMatchObject({ ok: false, record: { outcome: 'failed', schemaViolations: ['The output is not valid JSON.'] } });
  });

  it('keeps the Outline\'s standards and Lesson Type whatever the model wrote', async () => {
    const drifted = sampleLesson();
    drifted.header.focusStandards = ['RL.6.99'];
    const reply = JSON.stringify({ lesson: drifted, digest: placeholderOutput(lesson('L3')).digest });
    const result = await generateLesson(client([reply]).client, input('L3'), 'u4/L3');
    expect(result.ok && result.lesson.header.focusStandards).toEqual(['L.6.4.b', 'RI.6.4']);
  });

  it('reports a refused or cut-off answer without a repair call', async () => {
    const refusing = {
      mode: 'fake' as const,
      model: 'fake',
      complete: async () => ({ text: '', model: 'fake', stopReason: 'refusal' as const, usage: placeholderUsage(), durationMs: 1 }),
    };
    const result = await generateLesson(refusing, input('L3'), 'u4/L3');
    expect(result).toMatchObject({ ok: false, record: { failureReason: 'The model declined to write this Lesson.' } });
  });

  it('makes a valid placeholder Lesson for every Lesson in the sample Unit', () => {
    for (const row of confirmed.lessons) {
      const output = placeholderOutput(row);
      expect(output.lesson.lessonType).toBe(row.lessonType);
    }
  });
});

function placeholderUsage() {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
}

describe('what a Generation Attempt records', () => {
  const valid = () => JSON.stringify({ lesson: sampleLesson(), digest: placeholderOutput(lesson('L3')).digest });
  const scripted = (mode: 'live' | 'replay', steps: (() => LlmResult)[]): LlmClient => {
    let call = 0;
    return { mode, model: mode === 'live' ? 'claude-sonnet-5-5' : 'replay', complete: async () => steps[call++]!() };
  };
  const result = (model: string, text: string, input: number, output: number): LlmResult => ({
    text,
    model,
    stopReason: 'end_turn',
    usage: { inputTokens: input, outputTokens: output, cacheReadTokens: 0, cacheWriteTokens: 0 },
    durationMs: 10,
  });

  // LCG-12 regressions. Found by: Phase 3 spec review (attempts recorded the wrong model and cost).
  it('LCG-12: prices an answer by the model that gave it (a refusal fallback)', async () => {
    const outcome = await generateLesson(
      scripted('live', [() => result('claude-opus-5-5', valid(), 1000, 2000)]),
      input('L3'),
      'u4/L3',
    );
    expect(outcome.record).toMatchObject({ model: 'claude-opus-5-5', costUsd: 0.044 });
  });

  it('LCG-12: keeps the spend of earlier calls when a later call fails, saying why', async () => {
    const outcome = await generateLesson(
      scripted('live', [
        () => result('claude-sonnet-5-5', 'not json', 1000, 1000),
        () => {
          throw new Anthropic.APIError(529, undefined, 'Overloaded', undefined);
        },
      ]),
      input('L3'),
      'u4/L3',
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.record.costUsd).toBeCloseTo(0.012, 6);
    expect(outcome.record.failureReason).toMatch(/529/);
  });

  it('LCG-12: records what a replayed run originally cost, marked as a replay', async () => {
    const outcome = await generateLesson(
      scripted('replay', [() => result('claude-sonnet-5-5', valid(), 1000, 1000)]),
      input('L3'),
      'u4/L3',
    );
    expect(outcome.record).toMatchObject({ mode: 'replay', model: 'claude-sonnet-5-5', costUsd: 0.012 });
  });
});
