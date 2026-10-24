import {
  LESSON_MINUTES,
  sectionMinutes,
  studentView,
  type Activity,
  type Block,
  type Lesson,
  type LessonType,
  type StudentBlock,
  type StudentLesson,
} from '@lcg/lesson-schema';
import { getStandard } from '@lcg/standards';
import {
  SAMPLE_RESPONSE_COLOR,
  TEACHER_SCRIPT_COLOR,
  bulletList,
  callout,
  collapsible,
  color,
  doc,
  em,
  inline,
  paragraph,
  plain,
  routineHeading,
  strong,
  table,
  text,
} from './rich-text.js';
import type {
  NewselaLesson,
  NewselaNode,
  NewselaObjective,
  NewselaSection,
  NewselaStandardList,
} from './types.js';

export interface NewselaContext {
  /** The Lesson's number in its Unit, for the "Lesson N: Title" title. */
  lessonNumber?: number;
  /** The Unit's title. Newsela carries it only in breadcrumbs, which we do not produce. */
  unitTitle?: string;
}

export interface NewselaConversion {
  lesson: NewselaLesson;
  /**
   * What the converted lesson does not represent. Entries that stand for a whole top-level key
   * of Newsela's lesson object start with that key ("anchor_text_cards: ...").
   */
  unmapped: string[];
}

/** Our Lesson Types as Newsela's type labels. Core Writing and Writing are both "Writing". */
const TYPE_LABELS: Record<LessonType, string> = {
  spark: 'Spark',
  'core-reading': 'Reading',
  'core-writing': 'Writing',
  'academic-discussion': 'Academic Discussion',
  writing: 'Writing',
  'flex-day': 'Flex Day',
};

const OBJECTIVE_TITLES: Record<
  Lesson['header']['objectives'][number]['kind'],
  NewselaObjective['title']
> = {
  content: 'Content',
  language: 'Language',
  'foundational-skills': 'Foundational Skills',
};

const MOVE_LABELS = { say: 'Say:', ask: 'Ask:', teach: 'Teach:' } as const;

/**
 * Converts a Lesson to the shape of Newsela's published lesson object, so a Unit Release could be
 * imported into Newsela's product. A demonstration on the common blocks (PRD story 133): what it
 * cannot represent is listed in `unmapped` rather than invented.
 */
export function toNewselaLesson(lesson: Lesson, context: NewselaContext = {}): NewselaConversion {
  const { header } = lesson;
  const student = studentView(lesson);
  const unmapped: string[] = [
    'id: Newsela assigns lesson IDs; we have none',
    'breadcrumbs: they hold Newsela course and unit URLs we do not have',
    'materials: Lesson JSON has no materials list',
    'anchor_text_cards: Lesson Texts need Newsela text IDs, images and links we do not have',
    'resource_cards: graphic organizers and other PDFs need Newsela resource IDs and links',
  ];

  const standardLists: NewselaStandardList[] = [
    { title: 'California CCSS: Focus Standards', standards: header.focusStandards.map(described) },
    {
      title: 'California CCSS: Supporting Standards',
      standards: header.supportingStandards.map(described),
    },
    { title: 'ELD Standards', standards: header.eldStandards.map(described) },
  ];
  const undescribed = standardLists.flatMap((l) =>
    l.standards.filter((s) => !s.description).map((s) => s.code),
  );
  if (undescribed.length > 0)
    unmapped.push(`standard descriptions: no official text for ${undescribed.join(', ')}`);
  if (header.mediaLiteracyStandards.length > 0) {
    unmapped.push(
      `Media Literacy Standards: Newsela's lesson object has no list for them (${header.mediaLiteracyStandards.join(', ')})`,
    );
  }
  if (lesson.sections.some((s) => s.activities.some((a) => a.standards.length > 0))) {
    unmapped.push(
      'Activity standards: shown only as text in the Activity heading, not as structured tags',
    );
  }
  unmapped.push('Activity IDs: Newsela sections have no stable Activity identifiers');
  if (context.unitTitle) unmapped.push('unit title: Newsela carries it only in breadcrumbs');

  const routines = [
    ...new Set(lesson.sections.flatMap((s) => s.activities.flatMap((a) => a.routine ?? []))),
  ];

  const converted: NewselaLesson = {
    title: context.lessonNumber ? `Lesson ${context.lessonNumber}: ${lesson.title}` : lesson.title,
    type: TYPE_LABELS[lesson.lessonType],
    subject: 'ELA',
    total_time_in_minutes: [LESSON_MINUTES, LESSON_MINUTES],
    standard_lists: standardLists,
    objectives: {
      teacher: header.objectives.map((o) => objective(o.kind, o.text, 'teacher')),
      // studentView keeps the objectives in order, with "Students will" dropped.
      student: header.objectives.map((o, i) =>
        objective(o.kind, student.objectives[i] ?? o.text, 'student'),
      ),
    },
    essential_questions: doc([
      bulletList(header.essentialQuestions.map((q) => [paragraph(inline(q))])),
    ]),
    connections: [
      {
        title: 'Knowledge-Building',
        body: doc([paragraph(inline(header.connections.knowledgeBuilding))]),
      },
      {
        title: 'Enduring Understanding',
        body: doc([paragraph(inline(header.connections.enduringUnderstanding))]),
      },
      { title: 'Future Lessons', body: doc([paragraph(inline(header.connections.futureLessons))]) },
      {
        title: 'Unit Performance Task',
        body: doc([paragraph(inline(header.connections.performanceTask))]),
      },
    ],
    routines: doc(
      routines.length > 0 ? [bulletList(routines.map((r) => [paragraph([text(r)])]))] : [],
    ),
    vocabulary_lists: [
      {
        title: 'Vocabulary Addressed in Lesson',
        vocabulary: vocabulary(header.vocabulary, 'addressed'),
      },
      {
        title: 'Vocabulary for Additional Support',
        vocabulary: vocabulary(header.vocabulary, 'support'),
      },
    ],
    differentiators: [],
    sections: {
      teacher: lesson.sections.map((section, i) => {
        const minutes = sectionMinutes(section);
        return {
          title: section.title,
          purpose: doc([paragraph(inline(section.purpose))]),
          audience: 'teacher',
          sequence: i + 1,
          estimated_time_in_minutes: [minutes, minutes],
          body: doc(section.activities.flatMap(teacherActivity)),
        } satisfies NewselaSection;
      }),
      student: student.sections.map(
        (section, i) =>
          ({
            title: section.title,
            purpose: doc([]),
            audience: 'student',
            sequence: i + 1,
            estimated_time_in_minutes: [0, 0],
            body: doc(section.activities.flatMap(studentActivity)),
          }) satisfies NewselaSection,
      ),
    },
  };

  return { lesson: converted, unmapped };
}

function described(code: string): { code: string; description: string } {
  return { code, description: getStandard(code)?.text ?? '' };
}

function objective(
  kind: Lesson['header']['objectives'][number]['kind'],
  wording: string,
  audience: NewselaObjective['audience'],
): NewselaObjective {
  return { title: OBJECTIVE_TITLES[kind], body: doc([paragraph(inline(wording))]), audience };
}

function vocabulary(words: Lesson['header']['vocabulary'], tier: 'addressed' | 'support') {
  return words
    .filter((w) => w.tier === tier)
    .map((w) => ({ word: w.word, definition: plain(w.definition) }));
}

// ---------------------------------------------------------------------------------------------
// Section bodies

/** "Part A: Reading (RI.6.4, L.6.4.b) (15 minutes)", the way Newsela titles its Activities. */
function teacherActivity(activity: Activity): NewselaNode[] {
  const codes = activity.standards.length > 0 ? ` (${activity.standards.join(', ')})` : '';
  const minutes = activity.minutes > 0 ? ` (${activity.minutes} minutes)` : '';
  return [
    routineHeading(routineIcon(activity), `${activity.title}${codes}${minutes}`),
    ...activity.blocks.flatMap(teacherBlock),
  ];
}

function studentActivity(
  activity: StudentLesson['sections'][number]['activities'][number],
): NewselaNode[] {
  return [
    routineHeading(routineIcon(activity), activity.title),
    ...activity.blocks.flatMap(studentBlock),
  ];
}

/** The routine_heading icon Newsela would use, guessed from the routine name or Activity title. */
function routineIcon(activity: { title: string; routine?: string }): string {
  const name = `${activity.routine ?? ''} ${activity.title}`.toLowerCase();
  if (/pulse check|reflection/.test(name)) return 'cfu';
  if (/writ/.test(name)) return 'writing';
  if (/talk|discuss|share|seminar|give one/.test(name)) return 'academic_discussion';
  if (/organizer|chart/.test(name)) return 'graphic_organizer';
  if (/dictionary/.test(name)) return 'personal_dictionary';
  if (/read|annotat/.test(name)) return 'reading';
  return 'notes_section';
}

const teal = color(TEACHER_SCRIPT_COLOR);
const purple = color(SAMPLE_RESPONSE_COLOR);

function teacherBlock(block: Block): NewselaNode[] {
  switch (block.type) {
    case 'teacher-script':
      return [
        paragraph([
          text(MOVE_LABELS[block.move], [strong]),
          text(' ', [teal]),
          ...inline(block.text, [teal]),
        ]),
      ];
    case 'sample-response':
      return [paragraph(inline(block.text, [purple]))];
    case 'teacher-note':
      return block.variant === 'tip'
        ? [
            table(
              [[paragraph([text('Teacher Tip', [strong, purple])])]],
              [[[paragraph(inline(block.text))]]],
            ),
          ]
        : [paragraph(inline(block.text, [em]))];
    case 'directions':
      return [directions(block.text)];
    case 'paragraph':
      return [paragraph(inline(block.text))];
    case 'text-reference':
      return [textReference(block)];
    case 'pulse-check':
      return [
        pulseCheck(
          block.standards,
          block.stem,
          block.choices.map((c) => ({
            text: c.text,
            rationale: [
              text(c.correct ? 'Correct:' : 'Incorrect:', [strong]),
              text(' '),
              ...inline(c.rationale),
            ],
          })),
        ),
      ];
    case 'eld-panel':
      return [
        collapsible('Integrated ELD Instructions', [
          callout('purpose', [paragraph(inline(block.purpose))]),
          callout('say', [paragraph(inline(block.sayAsk))]),
          callout('watch', [paragraph(inline(block.watchFor))]),
        ]),
      ];
    case 'support-table':
      return [
        collapsible('Additional Student Support', [
          table(
            [[paragraph([text('Situation', [strong])])], [paragraph([text('Try this', [strong])])]],
            block.rows.map((row) => [
              [paragraph(inline(row.situation, [strong]))],
              [paragraph(inline(row.tryThis))],
            ]),
          ),
        ]),
      ];
  }
}

/** Student blocks hold no teacher material (studentView removed it), so nothing here is teacher-only. */
function studentBlock(block: StudentBlock): NewselaNode[] {
  switch (block.type) {
    case 'directions':
      return [directions(block.text)];
    case 'paragraph':
      return [paragraph(inline(block.text))];
    case 'text-reference':
      return [textReference(block)];
    case 'pulse-check':
      return [
        pulseCheck(
          [],
          block.stem,
          block.choices.map((choice) => ({ text: choice })),
        ),
      ];
  }
}

function directions(source: string): NewselaNode {
  return paragraph([text('Directions:', [strong]), text(' '), ...inline(source)]);
}

function textReference(block: { title: string; pages?: string }): NewselaNode {
  return paragraph([...inline(block.title), ...(block.pages ? [text(`, ${block.pages}`)] : [])]);
}

/**
 * A Pulse Check as Newsela lays one out: a table whose header is a cfu routine heading naming the
 * standards, and whose cell holds the stem, then each lettered choice (with its rationale for teachers).
 */
function pulseCheck(
  standards: string[],
  stem: string,
  choices: { text: string; rationale?: NewselaNode[] }[],
): NewselaNode {
  const heading = standards.length > 0 ? `Pulse Check (${standards.join(', ')})` : 'Pulse Check';
  const cell = [
    paragraph(inline(stem)),
    ...choices.flatMap((choice, i) => [
      paragraph([text(`${String.fromCharCode(65 + i)}. `), ...inline(choice.text)]),
      ...(choice.rationale ? [paragraph(choice.rationale)] : []),
    ]),
  ];
  return table([[routineHeading('cfu', heading)]], [[cell]]);
}
