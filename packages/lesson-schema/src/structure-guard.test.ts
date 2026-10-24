import { getSchema } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import { lessonToDocument } from './convert.js';
import { lessonDocumentExtensions } from './editor-schema.js';
import { LessonStructureGuard, STRUCTURE_CHANGE_META, structureSignature } from './structure-guard.js';
import { sampleLesson } from './testing.js';

const schema = getSchema(lessonDocumentExtensions);
const plugins = LessonStructureGuard.config.addProseMirrorPlugins!.call({} as never);

function state() {
  return EditorState.create({ schema, doc: schema.nodeFromJSON(lessonToDocument(sampleLesson())), plugins });
}

/** Position and node of the n-th top-level child. */
function child(s: EditorState, index: number) {
  let pos = 0;
  for (let i = 0; i < index; i++) pos += s.doc.child(i).nodeSize;
  return { pos, node: s.doc.child(index) };
}

describe('LessonStructureGuard', () => {
  it('describes the structure as header plus Section kinds', () => {
    expect(structureSignature(state().doc)).toBe(
      'lessonHeader|section:launch|section:learning-in-action|section:look-back|section:homework',
    );
  });

  it('allows edits inside a Section', () => {
    const s = state();
    const { pos, node } = child(s, 1);
    const activity = node.child(0);
    const tr = s.tr.delete(pos + 1, pos + 1 + activity.nodeSize);
    expect(s.applyTransaction(tr).state.doc.child(1).childCount).toBe(node.childCount - 1);
  });

  it('refuses to delete a Section', () => {
    const s = state();
    const { pos, node } = child(s, 3);
    const { state: next } = s.applyTransaction(s.tr.delete(pos, pos + node.nodeSize));
    expect(structureSignature(next.doc)).toBe(structureSignature(s.doc));
  });

  it('refuses to move a Section', () => {
    const s = state();
    const launch = child(s, 1);
    const lookBack = child(s, 3);
    // Move Launch after Look Back: insert a copy there, then delete the original.
    const tr = s.tr.insert(lookBack.pos + lookBack.node.nodeSize, launch.node);
    tr.delete(launch.pos, launch.pos + launch.node.nodeSize);
    const { state: next } = s.applyTransaction(tr);
    expect(structureSignature(next.doc)).toBe(structureSignature(s.doc));
  });

  it('refuses to change a Section into another kind', () => {
    const s = state();
    const { pos } = child(s, 1);
    const { state: next } = s.applyTransaction(s.tr.setNodeMarkup(pos, undefined, { kind: 'look-back' }));
    expect(structureSignature(next.doc)).toBe(structureSignature(s.doc));
  });

  it('lets a marked whole-Lesson replacement through', () => {
    const s = state();
    const { pos, node } = child(s, 4);
    const tr = s.tr.delete(pos, pos + node.nodeSize).setMeta(STRUCTURE_CHANGE_META, true);
    expect(s.applyTransaction(tr).state.doc.childCount).toBe(s.doc.childCount - 1);
  });
});
