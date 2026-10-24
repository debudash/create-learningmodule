import {
  ActivityNode,
  EldPanelNode,
  LessonHeaderNode,
  LessonStructureGuard,
  lessonDocumentExtensions,
  PulseCheckNode,
  SectionNode,
  SupportTableNode,
} from '@lcg/lesson-schema';
import { Extension, ReactNodeViewRenderer, type AnyExtension } from '@tiptap/react';
import { ActivityView } from './ActivityView';
import { EldPanelView, PulseCheckView, SupportTableView } from './FormBlockViews';
import { HeaderView } from './HeaderView';
import { SectionView } from './SectionView';

/** The shared Lesson schema with this app's node views attached. */
const VIEWS = new Map<AnyExtension, AnyExtension>([
  [LessonHeaderNode, LessonHeaderNode.extend({ addNodeView: () => ReactNodeViewRenderer(HeaderView) })],
  [SectionNode, SectionNode.extend({ addNodeView: () => ReactNodeViewRenderer(SectionView) })],
  [ActivityNode, ActivityNode.extend({ addNodeView: () => ReactNodeViewRenderer(ActivityView) })],
  [PulseCheckNode, PulseCheckNode.extend({ addNodeView: () => ReactNodeViewRenderer(PulseCheckView) })],
  [EldPanelNode, EldPanelNode.extend({ addNodeView: () => ReactNodeViewRenderer(EldPanelView) })],
  [SupportTableNode, SupportTableNode.extend({ addNodeView: () => ReactNodeViewRenderer(SupportTableView) })],
]);

const MarkShortcuts = Extension.create({
  name: 'lessonMarkShortcuts',
  addKeyboardShortcuts() {
    return {
      'Mod-b': () => this.editor.commands.toggleMark('bold'),
      'Mod-i': () => this.editor.commands.toggleMark('italic'),
    };
  },
});

export function lessonEditorExtensions(): AnyExtension[] {
  return [...lessonDocumentExtensions.map((ext) => VIEWS.get(ext) ?? ext), LessonStructureGuard, MarkShortcuts];
}
