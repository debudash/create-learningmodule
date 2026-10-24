'use client';

import { SECTION_PLANS, SECTION_TITLES, type LessonType, type SectionKind } from '@lcg/lesson-schema';
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { SmallButton, TextInput } from './fields';
import { newActivity } from './templates';

/** A fixed Section of the Lesson: its heading, purpose, minutes against target, and Activities. */
export function SectionView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const kind = node.attrs.kind as SectionKind;
  const lessonType = editor.state.doc.firstChild?.attrs.lessonType as LessonType;
  const target = SECTION_PLANS[lessonType]?.find((p) => p.kind === kind)?.minutes;
  let minutes = 0;
  node.forEach((activity) => (minutes += Number(activity.attrs.minutes) || 0));
  const readOnly = !editor.isEditable;
  const offTarget = target !== undefined && minutes !== target;

  const addActivity = () => {
    const end = (getPos() ?? 0) + node.nodeSize - 1;
    editor.chain().insertContentAt(end, newActivity()).run();
  };

  return (
    <NodeViewWrapper as="section" id={`section-${kind}`} className="mb-10 scroll-mt-24">
      <div contentEditable={false} className="mb-3 border-b border-line pb-2">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-xl font-semibold">{node.attrs.title || SECTION_TITLES[kind]}</h2>
          <span
            className={`text-sm tabular-nums ${offTarget ? 'font-semibold text-danger' : 'text-ink-soft'}`}
            title={target !== undefined ? `Target for this Lesson Type: ${target} minutes` : undefined}
          >
            {minutes} min{target !== undefined && ` / ${target}`}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-sm text-ink-soft">
          <span className="shrink-0 font-medium">Purpose:</span>
          <TextInput
            value={node.attrs.purpose}
            disabled={readOnly}
            placeholder="Why this part of the Lesson exists"
            onChange={(purpose) => updateAttributes({ purpose })}
          />
        </div>
      </div>
      <NodeViewContent className="space-y-4" />
      {!readOnly && (
        <div contentEditable={false} className="mt-2">
          <SmallButton onClick={addActivity}>+ Add activity</SmallButton>
        </div>
      )}
    </NodeViewWrapper>
  );
}
