import { Extension, type Editor } from '@tiptap/react';

/**
 * Moves the node that starts at `pos` one place up or down among its siblings
 * (an Activity within its Section, or a block within its Activity). Returns false
 * when it is already first or last.
 */
export function moveNode(editor: Editor, pos: number, direction: -1 | 1): boolean {
  const { state } = editor;
  const $pos = state.doc.resolve(pos);
  const index = $pos.index();
  const parent = $pos.parent;
  const node = parent.maybeChild(index);
  const sibling = parent.maybeChild(index + direction);
  if (!node || !sibling) return false;

  const tr = state.tr.delete(pos, pos + node.nodeSize);
  const target = direction === 1 ? pos + sibling.nodeSize : pos - sibling.nodeSize;
  tr.insert(target, node);
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/** Depth of a block inside an Activity: doc › section › activity › block. */
const BLOCK_DEPTH = 3;

/** Alt+Up / Alt+Down move the text block holding the cursor within its Activity. */
export const BlockMoveShortcuts = Extension.create({
  name: 'lessonBlockMoves',
  addKeyboardShortcuts() {
    const move = (direction: -1 | 1) => () => {
      const { $from } = this.editor.state.selection;
      if ($from.depth < BLOCK_DEPTH) return false;
      return moveNode(this.editor, $from.before(BLOCK_DEPTH), direction);
    };
    return { 'Alt-ArrowUp': move(-1), 'Alt-ArrowDown': move(1) };
  },
});
