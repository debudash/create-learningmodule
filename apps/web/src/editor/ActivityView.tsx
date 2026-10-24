'use client';

import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useState } from 'react';
import { CodesInput, SmallButton, TextInput } from './fields';
import { BLOCK_CHOICES } from './block-menu';
import { moveNode } from './move';

/** A timed Activity: title, minutes, standards and routine, then its blocks. */
export function ActivityView({ node, updateAttributes, editor, getPos, deleteNode }: NodeViewProps) {
  const readOnly = !editor.isEditable;
  const [adding, setAdding] = useState(false);

  const addBlock = (index: number) => {
    const end = (getPos() ?? 0) + node.nodeSize - 1;
    editor.chain().insertContentAt(end, BLOCK_CHOICES[index]!.content).focus(end + 1).run();
    setAdding(false);
  };

  return (
    <NodeViewWrapper
      className="rounded-lg border border-line bg-paper-raised px-4 py-3 shadow-sm"
      data-activity-id={node.attrs.id}
    >
      <div contentEditable={false} className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <TextInput
          value={node.attrs.title}
          disabled={readOnly}
          onChange={(title) => updateAttributes({ title })}
          className="min-w-0 flex-1 font-semibold"
        />
        <label className="flex items-center gap-1 text-sm text-ink-soft">
          <input
            type="number"
            min={0}
            max={60}
            value={node.attrs.minutes}
            disabled={readOnly}
            onChange={(e) => updateAttributes({ minutes: Number(e.target.value) })}
            className="w-14 rounded-md border border-line bg-paper px-1 py-0.5 text-right tabular-nums disabled:border-transparent disabled:bg-transparent"
          />
          min
        </label>
        {!readOnly && (
          <>
            <SmallButton onClick={() => moveNode(editor, getPos() ?? 0, -1)}>Up</SmallButton>
            <SmallButton onClick={() => moveNode(editor, getPos() ?? 0, 1)}>Down</SmallButton>
            <SmallButton tone="danger" onClick={deleteNode}>
              Delete
            </SmallButton>
          </>
        )}
      </div>
      <div contentEditable={false} className="flex flex-wrap items-center gap-3 px-2 text-sm">
        <span className="text-ink-soft">Teaches</span>
        <div className="min-w-48 flex-1">
          <CodesInput
            value={node.attrs.standards}
            disabled={readOnly}
            onChange={(standards) => updateAttributes({ standards })}
          />
        </div>
        <span className="text-ink-soft">Routine</span>
        <TextInput
          value={node.attrs.routine ?? ''}
          disabled={readOnly}
          placeholder="e.g. Turn and Talk"
          onChange={(routine) => updateAttributes({ routine: routine || null })}
          className="max-w-48"
        />
      </div>

      <NodeViewContent className="mt-2" />

      {!readOnly && (
        <div contentEditable={false} className="mt-2">
          {adding ? (
            <div className="flex flex-wrap gap-1 rounded-md bg-paper-sunk p-2">
              {BLOCK_CHOICES.map((choice, i) => (
                <button
                  key={choice.label}
                  type="button"
                  onClick={() => addBlock(i)}
                  className={`rounded px-2 py-1 text-xs font-medium hover:bg-paper-raised ${choice.teacherOnly ? 'text-teacher' : 'text-ink'}`}
                >
                  {choice.label}
                </button>
              ))}
              <SmallButton onClick={() => setAdding(false)}>Cancel</SmallButton>
            </div>
          ) : (
            <SmallButton onClick={() => setAdding(true)}>+ Add block</SmallButton>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}
