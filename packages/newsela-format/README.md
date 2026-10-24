# @lcg/newsela-format

A pure converter from our Lesson JSON to the shape of Newsela's published lesson object, so a
Unit Release could be imported into Newsela's product (PRD story 133). It is a demonstration on
the common blocks, not a supported export.

```ts
const { lesson, unmapped } = toNewselaLesson(released, { lessonNumber: 3 });
```

The target shape is inferred from the public review site (ca-2026-review.newsela.com), whose
pages embed each lesson object; see `docs/source/example-lessons/STRUCTURE.md`. It is not an
official contract, and `src/types.ts` describes only the parts this converter fills in.

## What it maps

Header: `title` ("Lesson N: Title"), `type` (Spark, Reading, Writing, Academic Discussion,
Flex Day), `subject`, `total_time_in_minutes`, `standard_lists` (Focus, Supporting and ELD, with
official descriptions from `@lcg/standards`; ELD codes as we hold them, without Newsela's
proficiency-level suffixes), `objectives` (teacher and student wording), `essential_questions`,
`connections`, `routines`, `vocabulary_lists` and an empty `differentiators`.

Sections: one teacher and one student section per Section, with `title`, `purpose`, `sequence`,
`estimated_time_in_minutes` and a ProseMirror `body`. Student sections are built from the Student
View, so they hold no teacher-only material, purposes or times.

| Our block           | Newsela body                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Activity            | `routine_heading{icon}` "Title (standards) (N minutes)", then its blocks                                                                                     |
| teacher-script      | paragraph: bold "Say:" / "Ask:" / "Teach:", then text in teal `#208095`                                                                                      |
| sample-response     | paragraph in purple `#720780`                                                                                                                                |
| teacher-note (note) | italic paragraph                                                                                                                                             |
| teacher-note (tip)  | one-cell table headed "Teacher Tip"                                                                                                                          |
| directions          | paragraph: bold "Directions:", then text                                                                                                                     |
| paragraph           | paragraph                                                                                                                                                    |
| text-reference      | paragraph: text title and pages                                                                                                                              |
| pulse-check         | table headed by a `cfu` routine heading "Pulse Check (codes)"; lettered choices, each followed by "Correct:" / "Incorrect:" and its rationale (teacher only) |
| eld-panel           | `collapsible` "Integrated ELD Instructions" with `callout`s `purpose`, `say`, `watch`                                                                        |
| support-table       | `collapsible` "Additional Student Support" with a Situation / Try this table                                                                                 |

Inline **bold** and _italic_ become `strong` and `em` marks.

## What it does not map

Returned in `unmapped`, never invented:

- `id`, `breadcrumbs`: Newsela IDs and course URLs we do not have.
- `anchor_text_cards`, `resource_cards`: need Newsela text and resource IDs, images and links.
- `materials`: Lesson JSON has no materials list.
- Media Literacy Standards: Newsela's lesson object has no list for them.
- Activity standards: only as text in the Activity heading, not as structured tags.
- Activity IDs, and the Unit title (Newsela carries it only in breadcrumbs).

The `routine_heading` icon is guessed from the routine name and Activity title.
