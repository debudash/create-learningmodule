import type { JSONContent } from '@tiptap/react';

/** Content inserted by the editor's "add" menus. */

export function newActivity(): JSONContent {
  return {
    type: 'activity',
    attrs: { id: `a-${crypto.randomUUID().slice(0, 8)}`, title: 'New activity', minutes: 5, standards: [], routine: null },
    content: [{ type: 'directions' }],
  };
}

export const BLOCK_CHOICES: { label: string; content: JSONContent; teacherOnly: boolean }[] = [
  { label: 'Directions', content: { type: 'directions' }, teacherOnly: false },
  { label: 'Paragraph', content: { type: 'paragraph', attrs: { audience: 'shared' } }, teacherOnly: false },
  { label: 'Say', content: { type: 'teacherScript', attrs: { move: 'say' } }, teacherOnly: true },
  { label: 'Ask', content: { type: 'teacherScript', attrs: { move: 'ask' } }, teacherOnly: true },
  { label: 'Teach', content: { type: 'teacherScript', attrs: { move: 'teach' } }, teacherOnly: true },
  { label: 'Sample response', content: { type: 'sampleResponse' }, teacherOnly: true },
  { label: 'Teacher note', content: { type: 'teacherNote', attrs: { variant: 'note' } }, teacherOnly: true },
  { label: 'Teacher Tip', content: { type: 'teacherNote', attrs: { variant: 'tip' } }, teacherOnly: true },
  {
    label: 'Pulse Check',
    content: {
      type: 'pulseCheck',
      attrs: {
        standards: [],
        stem: '',
        choices: [
          { text: '', correct: true, rationale: '' },
          { text: '', correct: false, rationale: '' },
        ],
      },
    },
    teacherOnly: false,
  },
  { label: 'ELD panel', content: { type: 'eldPanel', attrs: { purpose: '', sayAsk: '', watchFor: '' } }, teacherOnly: true },
  {
    label: 'Support table',
    content: {
      type: 'supportTable',
      attrs: {
        rows: [
          { situation: 'Struggling with: ', tryThis: '' },
          { situation: 'Ready for extension', tryThis: '' },
        ],
      },
    },
    teacherOnly: true,
  },
];
