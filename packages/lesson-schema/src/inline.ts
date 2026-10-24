import type { JSONContent } from '@tiptap/core';

/**
 * Lesson JSON keeps text as plain strings with two inline marks in Markdown
 * form: **bold** and *italic* (***both***). A literal asterisk is written \*.
 */

type MarkName = 'bold' | 'italic';

/** "Say **this** now" → ProseMirror text nodes with marks. */
export function inlineToNodes(source: string): JSONContent[] {
  const tokens = source.split(/(\\\*|\*\*\*|\*\*|\*)/).filter((t) => t !== '');
  const nodes: JSONContent[] = [];
  let bold = false;
  let italic = false;

  for (const token of tokens) {
    if (token === '***') {
      bold = !bold;
      italic = !italic;
    } else if (token === '**') {
      bold = !bold;
    } else if (token === '*') {
      italic = !italic;
    } else {
      push(nodes, token === '\\*' ? '*' : token, bold, italic);
    }
  }
  // An unclosed marker means the text was never Markdown; keep it literally.
  if (bold || italic) return source ? [{ type: 'text', text: source }] : [];
  return nodes;
}

function push(nodes: JSONContent[], text: string, bold: boolean, italic: boolean): void {
  const marks = [...(bold ? ['bold'] : []), ...(italic ? ['italic'] : [])].map((type) => ({ type }));
  const last = nodes[nodes.length - 1];
  if (last && sameMarks(last.marks, marks)) {
    last.text += text;
    return;
  }
  nodes.push(marks.length > 0 ? { type: 'text', text, marks } : { type: 'text', text });
}

function sameMarks(a: JSONContent['marks'], b: { type: string }[]): boolean {
  const names = (a ?? []).map((m) => m.type).join(',');
  return names === b.map((m) => m.type).join(',');
}

/** ProseMirror text nodes → "Say **this** now". */
export function nodesToInline(nodes: JSONContent[] | undefined): string {
  let out = '';
  let open: MarkName[] = [];
  for (const node of nodes ?? []) {
    if (node.type !== 'text' || !node.text) continue;
    const marks = new Set((node.marks ?? []).map((m) => m.type as MarkName));
    const wanted: MarkName[] = (['bold', 'italic'] as const).filter((m) => marks.has(m));
    // Close marks that end here (innermost first), then open new ones.
    while (open.some((m) => !wanted.includes(m))) out += marker(open.pop()!);
    for (const m of wanted) {
      if (!open.includes(m)) {
        out += marker(m);
        open = [...open, m];
      }
    }
    out += node.text.replace(/\*/g, '\\*');
  }
  while (open.length > 0) out += marker(open.pop()!);
  return out;
}

const marker = (mark: MarkName) => (mark === 'bold' ? '**' : '*');
