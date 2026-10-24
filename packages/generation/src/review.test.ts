import { sampleOutlineCsv } from '@lcg/fixtures';
import { sampleLesson } from '@lcg/lesson-schema/testing';
import { parseOutlineCsv } from '@lcg/outline';
import { describe, expect, it } from 'vitest';
import { createFakeClient, type LlmRequest } from './llm.js';
import { reviewLesson } from './review.js';

const outline = parseOutlineCsv(sampleOutlineCsv()).lessons.find((l) => l.key === 'L3')!;
const input = { lesson: sampleLesson(), outline, anchorTextTitle: 'The Lightning Thief' };

describe('reviewLesson', () => {
  it('turns verdicts into Quality Check results, one per Focus Standard plus anchor-text use', async () => {
    const requests: LlmRequest[] = [];
    const client = createFakeClient((request) => {
      requests.push(request);
      return JSON.stringify({
        standards: [
          { code: 'L.6.4.b', verdict: 'taught', reason: 'Part A works through trans- and -tion.' },
          { code: 'RI.6.4', verdict: 'partly', reason: 'Word meaning is discussed but not tone.' },
        ],
        anchorText: { verdict: 'missing', reason: 'The Lesson never opens the novel.' },
      });
    });
    const result = await reviewLesson(client, input, 'u4/L3/review-1');
    expect(result).toMatchObject({
      ok: true,
      results: [
        { checkId: 'ai-standard', outcome: 'pass', message: 'L.6.4.b: Part A works through trans- and -tion.' },
        { checkId: 'ai-standard', outcome: 'warn', message: 'RI.6.4: Word meaning is discussed but not tone.' },
        { checkId: 'ai-anchor-text', outcome: 'fail', message: 'The Lesson never opens the novel.' },
      ],
    });
    const prompt = requests[0]!.messages[0]!.content as string;
    expect(prompt).toMatch(/RI\.6\.4: Determine the meaning of words and phrases/);
    expect(prompt).toMatch(/<lesson>[\s\S]*## Launch[\s\S]*<\/lesson>/);
  });

  it('warns about a Focus Standard the review did not judge', async () => {
    const client = createFakeClient(() =>
      JSON.stringify({ standards: [], anchorText: { verdict: 'uses', reason: 'Chapter 1.' } }),
    );
    const result = await reviewLesson(client, input, 'k');
    expect(result.ok && result.results.filter((r) => r.outcome === 'warn').map((r) => r.message)).toEqual([
      'L.6.4.b: the AI Review did not judge this standard.',
      'RI.6.4: the AI Review did not judge this standard.',
    ]);
  });

  it('reports an unreadable answer instead of inventing results', async () => {
    expect(await reviewLesson(createFakeClient(() => 'nonsense'), input, 'k')).toMatchObject({ ok: false });
  });
});
