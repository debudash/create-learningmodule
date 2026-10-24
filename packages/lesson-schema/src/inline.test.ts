import { describe, expect, it } from 'vitest';
import { inlineToNodes, nodesToInline } from './inline.js';

describe('inline Markdown and text nodes', () => {
  it.each([
    'plain text',
    'Say **this** now',
    'an *italic* word',
    '***both*** marks',
    '**bold then *both* then bold**',
    'five \\* three',
    '',
  ])('round-trips %j', (source) => {
    expect(nodesToInline(inlineToNodes(source))).toBe(source);
  });

  it('reads bold and italic marks', () => {
    expect(inlineToNodes('a **b** *c*')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'text', text: 'b', marks: [{ type: 'bold' }] },
      { type: 'text', text: ' ' },
      { type: 'text', text: 'c', marks: [{ type: 'italic' }] },
    ]);
  });

  it('keeps unbalanced asterisks literally', () => {
    expect(inlineToNodes('5 * 3 = 15')).toEqual([{ type: 'text', text: '5 * 3 = 15' }]);
  });

  it('escapes literal asterisks typed in the editor', () => {
    expect(nodesToInline([{ type: 'text', text: '5 * 3' }])).toBe('5 \\* 3');
  });

  it('writes adjacent marks so they read back identically', () => {
    const nodes = [
      { type: 'text', text: 'a', marks: [{ type: 'bold' }, { type: 'italic' }] },
      { type: 'text', text: 'b', marks: [{ type: 'italic' }] },
    ];
    expect(inlineToNodes(nodesToInline(nodes))).toEqual(nodes);
  });
});
