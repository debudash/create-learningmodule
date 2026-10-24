import { inlineToNodes } from '@lcg/lesson-schema';
import type { NewselaDoc, NewselaMark, NewselaNode } from './types.js';

/** Text colours Newsela's teacher sections use (STRUCTURE.md). */
export const TEACHER_SCRIPT_COLOR = '#208095';
export const SAMPLE_RESPONSE_COLOR = '#720780';

const OUR_MARK_TO_THEIRS: Record<string, NewselaMark> = {
  bold: { type: 'strong' },
  italic: { type: 'em' },
};

/** Lesson JSON inline text ("Say **this**") as Newsela text nodes, with extra marks on every node. */
export function inline(source: string, extra: NewselaMark[] = []): NewselaNode[] {
  return inlineToNodes(source).map((node) => {
    const marks = [
      ...(node.marks ?? []).flatMap((m) => OUR_MARK_TO_THEIRS[m.type] ?? []),
      ...extra,
    ];
    return marks.length > 0
      ? { type: 'text', text: node.text ?? '', marks }
      : { type: 'text', text: node.text ?? '' };
  });
}

/** Lesson JSON inline text without its marks, for Newsela's plain-string fields. */
export function plain(source: string): string {
  return inlineToNodes(source)
    .map((node) => node.text ?? '')
    .join('');
}

export const text = (value: string, marks: NewselaMark[] = []): NewselaNode =>
  marks.length > 0 ? { type: 'text', text: value, marks } : { type: 'text', text: value };

export const strong: NewselaMark = { type: 'strong' };
export const em: NewselaMark = { type: 'em' };
export const color = (value: string): NewselaMark => ({
  type: 'textColor',
  attrs: { color: value },
});

export const doc = (content: NewselaNode[]): NewselaDoc => ({ type: 'doc', content });

export const paragraph = (content: NewselaNode[]): NewselaNode => ({
  type: 'paragraph',
  attrs: { align: null },
  ...(content.length > 0 ? { content } : {}),
});

export const bulletList = (items: NewselaNode[][]): NewselaNode => ({
  type: 'bullet_list',
  content: items.map((content) => ({ type: 'list_item', content })),
});

export const routineHeading = (icon: string, title: string): NewselaNode => ({
  type: 'routine_heading',
  attrs: { icon },
  content: [text(title)],
});

export const callout = (variant: string, content: NewselaNode[]): NewselaNode => ({
  type: 'callout',
  attrs: { variant },
  content,
});

export const collapsible = (label: string, content: NewselaNode[]): NewselaNode => ({
  type: 'collapsible',
  attrs: { label },
  content,
});

const cell = (type: 'table_header' | 'table_cell', content: NewselaNode[]): NewselaNode => ({
  type,
  attrs: { colspan: 1, rowspan: 1 },
  content,
});

/** A table whose first row is a header row. Each cell is a list of block nodes. */
export function table(header: NewselaNode[][], rows: NewselaNode[][][]): NewselaNode {
  return {
    type: 'table',
    content: [
      { type: 'table_row', content: header.map((c) => cell('table_header', c)) },
      ...rows.map((row) => ({ type: 'table_row', content: row.map((c) => cell('table_cell', c)) })),
    ],
  };
}
