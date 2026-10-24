import { isTeacherOnlyNode, type BLOCK_TYPE_OF_NODE } from '@lcg/lesson-schema';
import type { JSONContent } from '@tiptap/react';

/** Content inserted by the editor's "add" menus. */

export function newActivity(): JSONContent {
  return {
    type: 'activity',
    attrs: { id: `a-${crypto.randomUUID().slice(0, 8)}`, title: 'New activity', minutes: 5, standards: [], routine: null },
    content: [{ type: 'directions' }],
  };
}

const CHOICES: { label: string; content: JSONContent }[] = [
  { label: 'Directions', content: { type: 'directions' } },
  { label: 'Paragraph', content: { type: 'paragraph', attrs: { audience: 'shared' } } },
  { label: 'Text', content: { type: 'textReference', attrs: { title: '', pages: '' } } },
  { label: 'Say', content: { type: 'teacherScript', attrs: { move: 'say' } } },
  { label: 'Ask', content: { type: 'teacherScript', attrs: { move: 'ask' } } },
  { label: 'Teach', content: { type: 'teacherScript', attrs: { move: 'teach' } } },
  { label: 'Sample response', content: { type: 'sampleResponse' } },
  { label: 'Teacher note', content: { type: 'teacherNote', attrs: { variant: 'note' } } },
  { label: 'Teacher Tip', content: { type: 'teacherNote', attrs: { variant: 'tip' } } },
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
  },
  { label: 'ELD panel', content: { type: 'eldPanel', attrs: { purpose: '', sayAsk: '', watchFor: '' } } },
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
  },
];

/** Blocks the "+ Add block" menu offers; teacher-only ones are marked by the Lesson schema's rule. */
export const BLOCK_CHOICES = CHOICES.map((choice) => ({
  ...choice,
  teacherOnly: isTeacherOnlyNode(choice.content.type as keyof typeof BLOCK_TYPE_OF_NODE, choice.content.attrs),
}));
