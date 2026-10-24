'use client';

import { LESSON_TYPE_LABELS, type LessonHeader, type LessonType } from '@lcg/lesson-schema';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { CodesInput, Label, SmallButton, TextArea, TextInput } from './fields';

const OBJECTIVE_LABELS = {
  content: 'Content',
  language: 'Language',
  'foundational-skills': 'Foundational Skills',
} as const;

const CONNECTION_LABELS: Record<keyof LessonHeader['connections'], string> = {
  knowledgeBuilding: 'Knowledge-Building',
  enduringUnderstanding: 'Enduring Understanding',
  futureLessons: 'Future Lessons',
  performanceTask: 'Unit Performance Task',
};

type HeaderAttrs = LessonHeader & { title: string; lessonType: LessonType };

/** The Lesson header: title, standards, objectives, questions, connections, vocabulary, texts. */
export function HeaderView({ node, updateAttributes, editor }: NodeViewProps) {
  const attrs = node.attrs as HeaderAttrs;
  const readOnly = !editor.isEditable;
  const set = (patch: Partial<HeaderAttrs>) => updateAttributes(patch);

  const updateItem = <K extends 'objectives' | 'essentialQuestions' | 'vocabulary' | 'texts'>(
    key: K,
    index: number,
    item: HeaderAttrs[K][number],
  ) => set({ [key]: attrs[key].map((existing, i) => (i === index ? item : existing)) } as Partial<HeaderAttrs>);
  const removeItem = (key: 'objectives' | 'essentialQuestions' | 'vocabulary' | 'texts', index: number) =>
    set({ [key]: attrs[key].filter((_, i) => i !== index) } as Partial<HeaderAttrs>);

  return (
    <NodeViewWrapper contentEditable={false} className="mb-8 rounded-xl border border-line bg-paper-raised p-6">
      <div className="text-sm font-medium text-accent">{LESSON_TYPE_LABELS[attrs.lessonType]} · 50 min</div>
      <TextInput
        value={attrs.title}
        disabled={readOnly}
        onChange={(title) => set({ title })}
        className="mt-1 font-serif text-2xl font-semibold"
      />

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {(
          [
            ['focusStandards', 'Focus Standards'],
            ['supportingStandards', 'Supporting Standards'],
            ['eldStandards', 'ELD Standards'],
            ['mediaLiteracyStandards', 'Media Literacy Standards'],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <Label>{label}</Label>
            <CodesInput value={attrs[key]} disabled={readOnly} onChange={(codes) => set({ [key]: codes })} />
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Label>Student Learning Objectives</Label>
        <ul className="space-y-2">
          {attrs.objectives.map((objective, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-36 shrink-0 pt-1.5 text-sm font-medium text-ink-soft">
                {OBJECTIVE_LABELS[objective.kind]}
              </span>
              <TextArea
                value={objective.text}
                disabled={readOnly}
                onChange={(text) => updateItem('objectives', i, { ...objective, text })}
              />
              {!readOnly && <SmallButton tone="danger" onClick={() => removeItem('objectives', i)}>Remove</SmallButton>}
            </li>
          ))}
        </ul>
        {!readOnly && (
          <div className="mt-1 flex gap-1">
            {(Object.keys(OBJECTIVE_LABELS) as (keyof typeof OBJECTIVE_LABELS)[]).map((kind) => (
              <SmallButton key={kind} onClick={() => set({ objectives: [...attrs.objectives, { kind, text: '' }] })}>
                + {OBJECTIVE_LABELS[kind]}
              </SmallButton>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <Label>Essential Questions</Label>
        {attrs.essentialQuestions.map((question, i) => (
          <div key={i} className="flex items-center gap-2">
            <TextInput
              value={question}
              disabled={readOnly}
              onChange={(text) => updateItem('essentialQuestions', i, text)}
            />
            {!readOnly && <SmallButton tone="danger" onClick={() => removeItem('essentialQuestions', i)}>Remove</SmallButton>}
          </div>
        ))}
        {!readOnly && (
          <SmallButton onClick={() => set({ essentialQuestions: [...attrs.essentialQuestions, ''] })}>+ Question</SmallButton>
        )}
      </div>

      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-semibold text-ink-soft">Connections to</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {(Object.keys(CONNECTION_LABELS) as (keyof LessonHeader['connections'])[]).map((key) => (
            <div key={key}>
              <Label>{CONNECTION_LABELS[key]}</Label>
              <TextArea
                value={attrs.connections[key]}
                disabled={readOnly}
                onChange={(text) => set({ connections: { ...attrs.connections, [key]: text } })}
              />
            </div>
          ))}
        </div>
      </details>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold text-ink-soft">
          Vocabulary ({attrs.vocabulary.length}) and Lesson Texts ({attrs.texts.length})
        </summary>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {attrs.vocabulary.map((entry, i) => (
              <tr key={i} className="align-top">
                <td className="w-40 py-1">
                  <TextInput value={entry.word} disabled={readOnly} onChange={(word) => updateItem('vocabulary', i, { ...entry, word })} />
                </td>
                <td className="py-1">
                  <TextInput
                    value={entry.definition}
                    disabled={readOnly}
                    onChange={(definition) => updateItem('vocabulary', i, { ...entry, definition })}
                  />
                </td>
                <td className="w-28 py-1 text-ink-soft">{entry.tier === 'addressed' ? 'Taught' : 'Support'}</td>
                <td className="w-16 py-1">
                  {!readOnly && <SmallButton tone="danger" onClick={() => removeItem('vocabulary', i)}>Remove</SmallButton>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!readOnly && (
          <SmallButton
            onClick={() => set({ vocabulary: [...attrs.vocabulary, { word: '', definition: '', tier: 'addressed' }] })}
          >
            + Word
          </SmallButton>
        )}
        <div className="mt-4">
          <Label>Lesson Texts</Label>
          {attrs.texts.map((text, i) => (
            <div key={i} className="flex gap-2">
              <TextInput value={text.title} disabled={readOnly} onChange={(title) => updateItem('texts', i, { ...text, title })} />
              <TextInput
                value={text.author ?? ''}
                disabled={readOnly}
                placeholder="Author"
                onChange={(author) => updateItem('texts', i, { ...text, author })}
                className="max-w-xs"
              />
            </div>
          ))}
        </div>
      </details>
    </NodeViewWrapper>
  );
}
