# Newsela example lessons: structure (facts only)

Source: https://ca-2026-review.newsela.com/course/cmkfw4elj004k8a90yvyfyfb8/unit/ck73kftqkdhaojqgqft3acmy/lesson/c0c4tx7u3mnezs5w9u8vzvi1
Fetched 2026-10-24 with plain `curl`. Every request returned HTTP 200 and needed no login. The site is a static, pre-rendered Next.js (App Router) export served from S3 through CloudFront (`Last-Modified: Tue, 21 Jul 2026`). The full lesson data is embedded in the page's RSC payload (`self.__next_f.push`) as a dehydrated React-Query object. The `*_data.json` files hold that object.

Course: **ELA Core 6th Grade** (California). It has 4 units with 45 lessons each:
1. Setting Out: Voice, Self & Agency (the linked lesson is Unit 1, Lesson 1)
2. The Art of Learning: Craft, Mentorship & Tradition
3. Curiosity, Evidence & Discovery: Hidden Figures
4. **Myths, Monsters & Modern Stories.** This unit uses *The Lightning Thief*, the same novel and unit as the Sample Unit Outline sheet.

## Files here
| File | What it is |
|---|---|
| `lesson1_raw.html`, `u1_lesson02_raw.html`, `u1_lesson20_raw.html`, `u4_lesson01_raw.html`, `u4_lesson04_raw.html`, `u4_lesson45_raw.html` | Raw page HTML |
| `*_data.json` | The extracted lesson object, the source of truth |
| `*_teacher_rendered.txt`, `*_student_rendered.txt` | Readable renderings of the sections. Tags: `[ROUTINE]`, `[CALLOUT]`, `[COLLAPSIBLE]`, `[TABLE]`, `{TEACHER-SCRIPT: ...}`, `{SAMPLE-RESPONSE: ...}`, `_italic_` = teacher note |
| `lesson1_text.txt`, `lesson1_rsc_payload.txt` | The visible text and the full RSC payload for Lesson 1 |
| `course_nav.json` | Course tree: units, then lessons, with URLs |
| `unit1_raw.html`, `unit4_raw.html`, `unit*_page_text.txt` | Unit overview pages |
| `unit4_all/u4_lessonNN_data.json` | All 45 Unit 4 lesson objects |

## Lesson object (top-level keys)
`id, title, type, subject, total_time_in_minutes, standard_lists, objectives, essential_questions, connections, routines, vocabulary_lists, anchor_text_cards, resource_cards, differentiators, breadcrumbs, sections`

- **title**: "Lesson N: <name>", for example "Lesson 1: Ordinary Moments, Extraordinary Stories, Part 1".
- **type**: values seen are Spark, Reading, Writing, Academic Discussion, Research, Flex Day, Mid-Unit Assessment, End Unit Assessment, Presentation.
- **total_time_in_minutes**: a pair such as `[50, 50]` (every lesson seen is 50 min). Section times are also `[min, max]` pairs.
- **standard_lists**: three lists, each with `{code, description}`:
  - "California CCSS: Focus Standards"
  - "California CCSS: Supporting Standards"
  - "ELD Standards"
  
  Codes look like `RI.6.1`, `SL.6.1.a`, `L.6.4.b`, `W.6.2.f`. ELD codes carry a proficiency-level suffix, for example `ELD.PI.6.6a.Br` / `.Em` / `.Ex` (Bridging/Emerging/Expanding), usually all three per standard. `ELD.PII.6.2b.Br` appears alone in U4 L4.
- **objectives**: `{teacher: [...], student: [...]}`. Each item is `{title, body, audience}`. The titles are **Content**, **Language**, and **Foundational Skills**, and a list can repeat Content (U1 L20 has three Content items for students). Teacher wording reads "Students will ..."; student wording drops that prefix ("Determine and explain ...").
- **essential_questions**: one or two questions, the unit/investigation EQs.
- **connections**: four titled blurbs: Knowledge-Building, Enduring Understanding, Future Lessons, Unit Performance Task.
- **routines**: a list of the routine names used, for example Turn and Talk, Think-Pair-Share, Graffiti/Table Talk, Quick Write, Language Study, Give One, Get One.
- **vocabulary_lists**: "Vocabulary Addressed in Lesson" and "Vocabulary for Additional Support", each a list of `{word, definition}`. Both are empty in U1 L1.
- **anchor_text_cards**: lesson texts as `{label: "Short-Form Text" | "Novel", title, author, type: "article" | "off-platform-text", href{student,teacher}}`.
- **resource_cards**: `{student:[], teacher:[]}` PDFs such as graphic organizers ("3-Column Chart", "Give One, Get One", "6.4 Performance Task").
- **differentiators**: an empty list in all 45 Unit 4 lessons and in the Unit 1 lessons checked.
- Rich text uses ProseMirror/TipTap JSON with custom nodes `routine_heading{icon}`, `callout{variant}` and `collapsible{label}`, plus `table`, `bullet_list`, `ordered_list` and `heading`. Marks are `strong`, `em` and `textColor`.

## Page header as rendered (teacher view)
Breadcrumb (Home > Course > Unit > Lesson), then the lesson type (e.g. "Spark"), the title and the duration ("50 min"). Below that, in order:
1. Focus Standards, Supporting Standards and ELD Standards chips, with "+ View all".
2. "Open Student Lesson" and "Share".
3. Student Learning Objectives (Content / Language / Foundational Skills).
4. Essential Questions and Connections to (the four blurbs).
5. **Lesson Pacing** table with columns Lesson Flow, Purpose of Learning Experience and minutes, plus a Routines list.
6. **Lesson Sequence** (expandable sections).
7. Lesson Texts (cards).

## Sections (`sections.teacher[]` / `sections.student[]`)
Each section has `{title, purpose, audience, sequence, estimated_time_in_minutes, body}`. The **teacher** and **student** versions are separate documents. Only the teacher version carries `purpose` text and times; the student sections have empty purpose and `[0,0]` times.

Ordered sections:
| # | Section | Typical minutes | Notes |
|---|---|---|---|
| 1 | **Launch** | 15 in Spark lessons, 5 elsewhere | Opening routine (Turn and Talk / Think-Pair-Share), then "Connection to Today's Learning" |
| 2 | **Literacy Lab** | 10 | Absent in Spark, assessment and flex-huddle lessons. Holds a "Language Study" routine (sentence-level grammar/morphology with a Chunk/Meaning/Function table). Sometimes titled, e.g. "Literacy Lab: Respectful Attribution in Research" |
| 3 | **Learning in Action** | 30, or 40 in assessment/flex lessons | Split into "Part A: ... (standards) (N minutes)" and "Part B: ... (N minutes)" |
| 4 | **Look Back** | 5 | Closing Quick Write or Reflection |
| 5 | **Homework** | 0 | Reading/annotation assignment. Absent in some lessons (U4 L1, L2, L20, L37). In U1 L1 it is a journal prompt |

Unit 4 section patterns across all 45 lessons:
- 35 lessons: Launch > Literacy Lab > Learning in Action > Look Back > Homework
- 4: Launch > Learning in Action > Look Back > Homework
- 4: Launch > Learning in Action > Look Back
- 2: Launch > Literacy Lab: <title> > Learning in Action > Look Back > Homework

### Building blocks inside the teacher sections
- **Routine heading** (`routine_heading` with an icon): `notes_section`, `cfu` (check for understanding), `writing`, `academic_discussion`, `graphic_organizer`, `personal_dictionary`, `reading`. In Unit 4: cfu 91, notes_section 58, writing 49.
- **Teacher moves**: bold labels **Say these Directions:**, **Say:**, **Ask:** and **Teach:**, followed by scripted teacher speech in teal (`#208095`).
- **Sample student responses**: purple (`#720780`) text nested under each Ask.
- **Teacher-only notes**: italic paragraphs, such as pacing and what to pause on.
- **Teacher Tip**: one-cell table, for example content warnings and read-aloud advice.
- **Pulse Check** (`cfu`): a table with a multiple-choice item. Each option has "Correct:" or "Incorrect:" plus a rationale, and the standards are listed in the heading, e.g. "Pulse Check (RL.6.4, L.6.4.a)".
- **Reflection** (`cfu`): a self-assessment prompt, sometimes a 1 to 5 rating.
- **Quick Write**: the lesson's exit writing in Look Back. In U4 L4 it answers the lesson's TDQ.
- **ELD support**: a collapsible **"Integrated ELD Instructions"** holding three callouts:
  - `purpose` (🎯 PURPOSE / Language Focus / Before Activity)
  - `say` (🗣️ SAY / ASK: prompts, recasts "You said X, we can say Y", sentence frames, home-language allowances)
  - `watch` (👁️ WATCH FOR / SUPPORT IF NEEDED: "If students ... → Prompt: ...", then success criteria)
  
  Unit 4 has 126 of these collapsibles, about 2 to 3 per lesson, attached to individual activities.
- **Differentiation**: a collapsible **"Additional Student Support[: <routine>]"** holding a Situation / Try this table with "Struggling with: ..." and "Ready for extension" rows. Unit 4 has 106.
- **Assessment lessons** (U4 L20, L37): Launch "Establish the Testing Environment" with a TEI Format Guide (MC, FITB, Multiple Select, Sorting, Sequencing). Learning in Action (40 min) is "Assessment Time!" with Active Monitoring Notes. Look Back is a Reflection. The assessment items are not in the page. These lessons use other text colours (`#4a86e8`, and `#bf360c` for "🛠️ TEACHER MOVES").
- **Flex Day lessons** (U1 L20; U4 L21, L38, L44): Learning in Action has "Huddle 1/2/3 (standard) + Independent Choice Work (10–15 minutes total)". Each huddle has Reteach, Guided Practice and Quick Check.

### Student version
It has the same section skeleton (Launch / Literacy Lab / Learning in Action / Look Back) but holds only:
- routine headings
- "Directions:" text
- the questions
- the Pulse Check and Reflection items, without the correct/incorrect rationale

It has no sample responses, no ELD or Additional Support collapsibles, no callouts, no purpose text and no times.

## Consistency across lessons checked
Detailed reads: U1 L1, L2, L20; U4 L1, L4, L45. All 45 Unit 4 lessons were scanned structurally. Every lesson has the same metadata shape and the Launch, Learning in Action, Look Back core, and every one runs 50 minutes. The variation is:
- Literacy Lab is present only in Reading, Writing, Discussion, Research and Presentation lessons.
- Spark lessons use a 15/30/5 split.
- Assessment and flex lessons use 5/40/5.
- Homework is optional.

## Unit overview page (`unit4_page_text.txt`)
The page shows:
- Unit Type: Core
- Suggested Pacing: 9 Weeks
- Performance Task: "Shared Stories, Shared Lessons"
- Unit Arc table:
  - Spark: L1–3
  - Investigation 1: L4–20 (L19 Socratic Seminar, L20 Investigation 1 Assessment)
  - Investigation 2: L21–38 (L21 Flex Huddle, L22–23 Flex Research, L36 Seminar, L37 Assessment, L38 Flex Huddle)
  - The Showcase lessons L39–45 are not in the summary table
- Knowledge Building Topic, "I'm Learning About", Knowledge Goals, Knowledge-Building Questions, Essential Questions per investigation, and the Unit Texts list
- Tabs: Overview / Lessons / Assessments / Additional Resources
