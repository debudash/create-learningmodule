'use client';

import type { Block } from '@lcg/lesson-schema';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import type { ReactNode } from 'react';
import { CodesInput, Label, SmallButton, TextArea, TextInput } from './fields';

type PulseCheck = Extract<Block, { type: 'pulse-check' }>;
type SupportTable = Extract<Block, { type: 'support-table' }>;

function BlockFrame({
  title,
  tone,
  readOnly,
  onDelete,
  children,
}: {
  title: string;
  tone: string;
  readOnly: boolean;
  onDelete: () => void;
  children: ReactNode;
}) {
  return (
    <NodeViewWrapper contentEditable={false} className={`my-3 rounded-md border px-3 py-2 ${tone}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
        {!readOnly && (
          <SmallButton tone="danger" onClick={onDelete}>
            Delete
          </SmallButton>
        )}
      </div>
      <div className="mt-1 space-y-2 text-ink">{children}</div>
    </NodeViewWrapper>
  );
}

export function PulseCheckView({ node, updateAttributes, editor, deleteNode }: NodeViewProps) {
  const attrs = node.attrs as Omit<PulseCheck, 'type'>;
  const readOnly = !editor.isEditable;
  const setChoice = (index: number, patch: Partial<PulseCheck['choices'][number]>) =>
    updateAttributes({
      choices: attrs.choices.map((choice, i) =>
        i === index
          ? { ...choice, ...patch }
          : patch.correct
            ? { ...choice, correct: false }
            : choice,
      ),
    });

  return (
    <BlockFrame title="Pulse Check" tone="border-accent bg-accent-soft text-accent" readOnly={readOnly} onDelete={deleteNode}>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-ink-soft">Checks</span>
        <CodesInput value={attrs.standards} disabled={readOnly} onChange={(standards) => updateAttributes({ standards })} />
      </div>
      <TextArea value={attrs.stem} disabled={readOnly} placeholder="Question" onChange={(stem) => updateAttributes({ stem })} />
      <ol className="space-y-2">
        {attrs.choices.map((choice, i) => (
          <li key={i} className="rounded-md bg-paper-raised p-2">
            <div className="flex items-center gap-2">
              <input
                type="radio"
                checked={choice.correct}
                disabled={readOnly}
                onChange={() => setChoice(i, { correct: true })}
                aria-label="Correct answer"
              />
              <span className="w-5 text-sm font-semibold text-ink-soft">{String.fromCharCode(65 + i)}.</span>
              <TextInput value={choice.text} disabled={readOnly} placeholder="Answer choice" onChange={(text) => setChoice(i, { text })} />
              {!readOnly && attrs.choices.length > 2 && (
                <SmallButton
                  tone="danger"
                  onClick={() => updateAttributes({ choices: attrs.choices.filter((_, j) => j !== i) })}
                >
                  Remove
                </SmallButton>
              )}
            </div>
            <div className="ml-12 flex items-center gap-2 text-sm">
              <span className={choice.correct ? 'font-semibold text-support' : 'text-ink-soft'}>
                {choice.correct ? 'Correct:' : 'Incorrect:'}
              </span>
              <TextInput
                value={choice.rationale}
                disabled={readOnly}
                placeholder="Why"
                onChange={(rationale) => setChoice(i, { rationale })}
              />
            </div>
          </li>
        ))}
      </ol>
      {!readOnly && attrs.choices.length < 6 && (
        <SmallButton
          onClick={() => updateAttributes({ choices: [...attrs.choices, { text: '', correct: false, rationale: '' }] })}
        >
          + Choice
        </SmallButton>
      )}
    </BlockFrame>
  );
}

export function EldPanelView({ node, updateAttributes, editor, deleteNode }: NodeViewProps) {
  const readOnly = !editor.isEditable;
  const parts = [
    ['purpose', 'Purpose'],
    ['sayAsk', 'Say / Ask'],
    ['watchFor', 'Watch for'],
  ] as const;
  return (
    <BlockFrame title="Integrated ELD Instructions" tone="border-eld bg-eld-soft text-eld" readOnly={readOnly} onDelete={deleteNode}>
      {parts.map(([key, label]) => (
        <div key={key}>
          <Label>{label}</Label>
          <TextArea value={node.attrs[key]} disabled={readOnly} onChange={(text) => updateAttributes({ [key]: text })} />
        </div>
      ))}
    </BlockFrame>
  );
}

export function SupportTableView({ node, updateAttributes, editor, deleteNode }: NodeViewProps) {
  const readOnly = !editor.isEditable;
  const rows = node.attrs.rows as SupportTable['rows'];
  const setRow = (index: number, patch: Partial<SupportTable['rows'][number]>) =>
    updateAttributes({ rows: rows.map((row, i) => (i === index ? { ...row, ...patch } : row)) });

  return (
    <BlockFrame title="Additional Student Support" tone="border-support bg-support-soft text-support" readOnly={readOnly} onDelete={deleteNode}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-ink-soft">
            <th className="w-2/5 pb-1 font-semibold">Situation</th>
            <th className="pb-1 font-semibold">Try this</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="align-top">
              <td className="pr-2">
                <TextArea value={row.situation} disabled={readOnly} onChange={(situation) => setRow(i, { situation })} />
              </td>
              <td>
                <TextArea value={row.tryThis} disabled={readOnly} onChange={(tryThis) => setRow(i, { tryThis })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && (
        <SmallButton onClick={() => updateAttributes({ rows: [...rows, { situation: '', tryThis: '' }] })}>+ Row</SmallButton>
      )}
    </BlockFrame>
  );
}
