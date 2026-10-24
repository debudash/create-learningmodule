import { SECTION_PLANS, SECTION_TITLES, type Lesson } from '@lcg/lesson-schema';
import type { OutlineLesson } from '@lcg/outline';
import type { GenerationOutput } from './output.js';

/**
 * A valid but obviously unfinished Lesson built from its Outline row, used by the
 * fake model mode (tests, offline work). It is labelled as a placeholder in every
 * Activity so it can never be mistaken for generated content.
 */
export function placeholderOutput(outline: OutlineLesson): GenerationOutput {
  const focus = outline.focusStandards.map((s) => s.code);
  const lesson: Lesson = {
    schemaVersion: 1,
    title: outline.heading ?? outline.title,
    lessonType: outline.lessonType,
    header: {
      focusStandards: focus,
      supportingStandards: outline.supportingStandards.map((s) => s.code),
      eldStandards: outline.eldStandards.map((s) => s.code),
      mediaLiteracyStandards: outline.mediaLiteracyStandards.map((s) => s.code),
      objectives: [{ kind: 'content', text: `Students will ${outline.textDependentQuestion ?? 'meet the Lesson goals'}` }],
      essentialQuestions: [],
      connections: { knowledgeBuilding: '', enduringUnderstanding: '', futureLessons: '', performanceTask: '' },
      vocabulary: outline.vocabulary.map((v) => ({ word: v.word, definition: '(placeholder)', tier: 'addressed' })),
      texts: [],
    },
    sections: SECTION_PLANS[outline.lessonType].map((plan) => ({
      kind: plan.kind,
      title: SECTION_TITLES[plan.kind],
      purpose: '(placeholder)',
      activities: [
        {
          id: `${plan.kind}-placeholder`,
          title: `${SECTION_TITLES[plan.kind]} (placeholder)`,
          minutes: plan.minutes,
          standards: plan.kind === 'learning-in-action' ? focus : [],
          blocks: [{ type: 'directions', text: `Placeholder content for ${outline.key}: ${outline.description.split('\n')[0]}` }],
        },
      ],
    })),
  };
  return {
    lesson,
    digest: { summary: `Placeholder for ${outline.key}.`, keyActivities: [], vocabularyTaught: [], standardsCovered: focus },
  };
}
