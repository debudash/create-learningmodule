# PRD: Lesson Content Generation and Approval Workflow

Source brief: [docs/source/project-brief.md](source/project-brief.md). Vocabulary follows [GLOSSARY.md](../GLOSSARY.md); terms in **bold** are defined there.

## Problem Statement

Newsela is entering the California "Core" curriculum market. A Core program is 40 weeks of daily instruction, delivered as four sequential **Units** of roughly 40–47 **Lessons** each, and it must pass a rigorous state approval process. Every Lesson is about 50 minutes of instruction aligned to specific CA ELA/ELD standards, with teacher scripts, student-facing tasks, sample responses, comprehension checks, and supports for English learners and struggling or advanced students.

Today those Lessons are written by hand by a large pool of freelance authors. From the content team's point of view this is slow, expensive and hard to coordinate: timelines are long, quality is uneven, and the team receives a flood of Lesson documents that each have to be reviewed, revised and then manually imported into Newsela's systems. At the scale of a full program (around 180 Lessons) this manual authoring step is the barrier to entering the market at all.

The content team already produces the most valuable artefact, the **Unit Outline**: an instructional designer's spreadsheet that says, row by row, what each Lesson must cover, which standards it teaches, which anchor text pages it uses, and how it builds toward the Unit's **Performance Task**. What they lack is a way to turn that Outline into complete, standards-aligned Lesson drafts in bulk, and a single place where 20+ staff can review, edit, approve and publish those Lessons without document shuffling.

Outlines are also imperfect. The sample Outline contains standard codes that do not exist, codes whose written descriptions contradict their official meaning, typos in filenames and designer notes mixed into content cells. Errors like these silently propagate into finished Lessons and surface late, in state review.

## Solution

An internal web tool in which content staff:

1. **Import a Unit Outline** from a Google Sheets link or an uploaded CSV/XLSX file. Before anything is generated, an import preview shows every Lesson, Flex Day and **Arc** the tool found, expands standard ranges into individual codes, and raises **Outline Issues**: codes that do not exist block import until fixed, and codes whose descriptions do not match their official text are flagged as warnings with a suggested correction. Generation always teaches the official text of the final code.
2. **Steer and start generation.** Staff edit plain-language **Generation Guidance** for the Unit, preview the exact prompt the AI will see, and generate either a small trial batch or the whole Unit. Generation runs in the background, several Lessons at a time, and the Unit board updates live as each Lesson moves from Queued to Generating to Draft. Each Lesson is generated from its Outline row, its Arc, its neighbouring rows, the official standards text, and real Newsela example Lessons of the same **Lesson Type**. Flex Days wait for their Arc to finish so they reteach what was actually taught.
3. **Review and edit together.** Each Lesson opens in a structured, collaborative editor in which several people can edit at once with named cursors. The Lesson's fixed structure (header, Launch, Literacy Lab, Learning in Action, Look Back, Homework) is protected, while every block inside is editable. A side panel shows **Quality Checks** (structure, pacing, standards coverage, an AI review of whether each Focus Standard is genuinely taught), the original Outline row for comparison, and the Lesson's history. Staff can switch between **Teacher View** and **Student View**, and use AI tools (rewrite with an instruction, add English-learner support, fix a failing check) that propose **AI Suggestions** to accept or reject, never silent edits.
4. **Approve through a clear workflow.** **Editors** submit Lessons for review; **Approvers** approve them or request changes with a stated reason, and can **Reopen** Approved Lessons. Approved Lessons are read-only. Every significant moment captures a **Lesson Version**, so anyone can compare the AI's original against the Approved text.
5. **Publish the Unit.** When every Lesson is Approved, an Approver publishes the Unit. This freezes a **Unit Release** of the Approved Lesson Versions and produces a structured export ready to be imported into Newsela's product. Later edits never alter a Release; the Unit shows **Unpublished Changes** until it is published again.

The tool ships with a pre-generated sample Unit (Grade 6, Unit 4, *The Lightning Thief*) spread across every workflow state, and a replay mode that re-runs generation from recorded AI responses, so it can be explored without an API key or any cost.

## User Stories

### Signing in and roles

1. As a content staff member, I want to sign in by choosing my name from a list, so that I can start working without account setup in this internal demo.
2. As a content staff member, I want my name and role shown in the app header, so that I always know which identity my actions are recorded under.
3. As a content staff member, I want to switch identity from the header, so that I can demonstrate how the workflow looks for an Editor and for an Approver.
4. As an Editor, I want actions I am not permitted to take (such as Approve) hidden or disabled with an explanation, so that I am not confused by buttons that fail.
5. As an Approver, I want to be able to do everything an Editor can do, so that I can fix small problems myself rather than sending Lessons back.
6. As an engineer, I want every permission enforced on the server as well as hidden in the UI, so that a crafted request cannot bypass the workflow.

### Units list

7. As a content staff member, I want a list of all Units with their grade, anchor text and status, so that I can see the whole program at a glance.
8. As a content staff member, I want each Unit to show a progress bar of Lesson states (Draft, In Review, Changes Requested, Approved), so that I can see how close it is to publication.
9. As a content staff member, I want to see whether a Unit is generating, published, or has Unpublished Changes, so that I know what needs attention.
10. As an Editor, I want a "New Unit" action on the Units list, so that I can start importing the next Outline.

### Importing an Outline

11. As an Editor, I want to paste a Google Sheets link to a Unit Outline, so that I can import the instructional designer's work directly from where it was authored.
12. As an Editor, I want to upload a CSV or XLSX export of an Outline, so that I can import Outlines from private sheets or other tools.
13. As an Editor, I want a clear message when a link cannot be read (for example because the sheet is private), so that I know to change its sharing settings or upload a file instead.
14. As an Editor, I want the tool to recognise the Unit title, grade, unit number and anchor text (title, author, ISBN) from the Outline, so that I do not have to retype them.
15. As an Editor, I want the tool to tell me when Outline metadata contradicts itself (for example, the title says Unit 4 but filenames say U3), so that I can choose the correct value.
16. As an Editor, I want an import preview listing every Lesson in Outline order with its number, Lesson Type, essential question, standards and vocabulary, so that I can confirm the tool understood the Outline before anything is generated.
17. As an Editor, I want Arcs (such as Spark, Investigation 1, Investigation 2, Showcase) recognised from header rows, with their descriptions and Performance Task skills, so that each Lesson is generated with an understanding of where it sits in the Unit.
18. As an Editor, I want Flex Day rows recognised as Lessons belonging to the Arc they follow, so that reteach days are part of the Unit like every other day of instruction.
19. As an Editor, I want summary rows such as the day total ignored, and the total checked against the number of Lessons found, so that the import cannot silently drop a day.
20. As an Editor, I want standard ranges like "W.6.3.a–e" expanded into individual codes, so that every sub-standard is tracked and checked.
21. As an Editor, I want Focus Standards, Supporting Standards, ELD Standards and Media Literacy Standards kept separate, so that the Lesson treats each with the right weight.
22. As an Editor, I want a standard code that does not exist (such as "RL.6.9.a") flagged as a Blocking Outline Issue, so that no Lesson is generated against a meaningless standard.
23. As an Editor, I want a malformed entry (such as a stray "6.2") flagged as a Blocking Outline Issue with a suggested correction, so that I can fix typos in a click.
24. As an Editor, I want a warning when an ELD code's written description does not match its official meaning, showing both side by side with a suggested code, so that I can decide which the designer intended.
25. As an Editor, I want to resolve each Outline Issue inline by accepting a suggestion, editing the value, removing the entry, or accepting the code as written, so that I do not have to edit the spreadsheet and re-import.
26. As an Editor, I want import to be impossible while Blocking Outline Issues remain, so that errors are fixed at the cheapest point.
27. As an Editor, I want Designer Notes in Outline cells preserved and passed to generation as guidance, so that the designer's intent (such as "too many vocabulary words") is honoured.
28. As an Editor, I want the Unit and its Lessons created only when I confirm the preview, so that abandoned imports leave nothing behind.
29. As an Editor, I want to see the original Outline row for any Lesson at any time after import, so that I can compare what was asked for with what was produced.

### Generation Guidance and prompt control

30. As an Editor, I want to edit the Unit's Generation Guidance in plain language before generating, so that I can steer tone, pacing and teaching preferences without engineering help.
31. As an Editor, I want sensible default Generation Guidance, so that I can generate a good first draft without writing anything.
32. As an Editor, I want to preview the full prompt that will be sent for a specific Lesson, with the locked part read-only, so that I understand exactly what the AI sees.
33. As an Editor, I want the output format, Lesson structure, standards rules and example Lessons locked, so that my guidance cannot accidentally break the editor or the Quality Checks.
34. As an Editor, I want every change to Generation Guidance saved as a new version, so that I can see how guidance evolved.
35. As a content staff member, I want each Lesson to record which Generation Guidance version produced it, so that differences between Lessons can be explained.

### Running generation

36. As an Editor, I want to generate a trial batch (for example the first three Lessons) before the whole Unit, so that I can check quality and adjust guidance before spending the full budget.
37. As an Editor, I want to generate all remaining Lessons in one action, so that a whole Unit is drafted without per-Lesson effort.
38. As an Editor, I want generation to run in the background, so that I can close the browser and come back later.
39. As an Editor, I want the Unit board to update live as Lessons move through Queued, Generating and Draft, so that I can watch progress.
40. As an Editor, I want a Unit-level progress indicator with counts and an estimated time remaining, so that I know when the Unit will be ready.
41. As an Editor, I want several Lessons generated at the same time, so that a full Unit finishes in minutes rather than hours.
42. As an Editor, I want Flex Days to start only after every Lesson in their Arc is generated, so that their reteaching reflects what was actually taught.
43. As an Editor, I want each Lesson generated with its Arc's purpose, the Performance Task, and the neighbouring Outline rows, so that Lessons connect to each other even when generated in parallel.
44. As an Editor, I want each Lesson generated from the official text of its standards, so that alignment is to the real standard and not the AI's memory of it.
45. As an Editor, I want each Lesson generated using real Newsela Lessons of the same Lesson Type as examples, so that the output matches house structure and style.
46. As an Editor, I want a Lesson whose generation fails to be marked Generation Failed with a readable reason, so that I know which Lessons need attention.
47. As an Editor, I want failed generations retried automatically a limited number of times, so that transient errors do not need manual action.
48. As an Editor, I want to retry a Generation Failed Lesson manually, so that I can recover once a problem is fixed.
49. As an Editor, I want generated output checked against the Lesson structure and repaired once if invalid, so that malformed AI output rarely reaches me.
50. As an Editor, I want to cancel generation for a Unit, so that I can stop spending if the trial batch shows the guidance is wrong.
51. As an engineer, I want generation to survive a worker restart without losing or duplicating Lessons, so that deploys and crashes do not corrupt a Unit.
52. As an engineer, I want queueing a Lesson and recording that it is Queued to happen together, so that a Lesson is never queued without being recorded or recorded without being queued.
53. As a content staff member, I want each Generation Attempt to record its model, token usage, cost, duration and outcome, so that the team can understand what generation costs.
54. As a content lead, I want the cost of generating a Unit shown on the Unit, so that I can budget for a full program.
55. As an engineer, I want the shared instructions and example Lessons cached across a Unit's generations, so that per-Lesson cost stays low.
56. As an operator of the hosted demo, I want real generation limited to Approvers and capped per day, so that a public link cannot run up the API bill.

### Regenerating

57. As an Editor, I want to Regenerate a Draft or Changes Requested Lesson, so that I can replace a poor draft without rewriting it by hand.
58. As an Editor, I want to give one-off extra instructions when regenerating a Lesson, so that I can correct a specific problem ("make the Turn and Talk about Percy's choice").
59. As an Editor, I want a confirmation before Regenerate replaces content, so that I do not lose edits by accident.
60. As an Editor, I want the content replaced by Regenerate kept as a Lesson Version, so that nothing is lost.
61. As an Editor, I want Regenerate unavailable on In Review and Approved Lessons, so that content under sign-off cannot be swapped out underneath an Approver.

### Unit board

62. As a content staff member, I want the Unit board to list Lessons grouped by Arc in Outline order, so that I can navigate the Unit the way the designer structured it.
63. As a content staff member, I want each Lesson row to show its status, Quality Check badges, Assignee and who is currently editing it, so that I can spot work and avoid collisions.
64. As an Approver, I want a "Needs my approval" filter, so that I can work through my review queue.
65. As an Editor, I want "Failing checks", "Changes Requested" and "Assigned to me" filters, so that I can find the Lessons that need me.
66. As an Editor, I want to claim a Lesson as its Assignee, so that colleagues know I am responsible for it.
67. As an Editor, I want to release or reassign a Lesson, so that work can be redistributed.
68. As an Approver, I want to select several In Review Lessons and approve them together, so that clean Lessons do not each need a separate visit.
69. As a content staff member, I want the board to load quickly for a Unit of ~50 Lessons with 20+ colleagues active, so that the tool never slows the team down.

### Lesson workspace and editor

70. As an Editor, I want to open a Lesson in a rich editor showing its header (standards, objectives, essential questions, pacing, vocabulary, texts) and its Sections in order, so that I can review the whole Lesson in one place.
71. As an Editor, I want to edit any text in the Lesson directly, with formatting, so that I can fix content without leaving the tool.
72. As an Editor, I want the Lesson's required Sections protected from being deleted or reordered, so that every Lesson keeps the house structure.
73. As an Editor, I want to add, remove, reorder and retime Activities within a Section, so that I can restructure instruction.
74. As an Editor, I want to change which standards an Activity is tagged with, so that alignment stays accurate after edits.
75. As an Editor, I want teacher scripts (Say/Ask), sample student responses, teacher notes and tips visually distinct, so that I can tell teacher-facing material from student-facing material at a glance.
76. As an Editor, I want to edit Pulse Checks as structured questions with choices, a correct answer and a rationale per choice, so that they cannot end up half-formed.
77. As an Editor, I want to edit Integrated ELD panels (purpose, say/ask, watch for) and Additional Support tables (struggling with / try this, ready for extension) as structured blocks, so that supports keep their standard shape.
78. As an Editor, I want an outline of Sections beside the editor to jump between them, so that I can move around a long Lesson quickly.
79. As an Editor, I want to see the current total of Activity minutes against the 50-minute target while I edit, so that I keep pacing realistic.
80. As an Editor, I want to toggle between Teacher View and Student View, so that I can check exactly what students will see.
81. As an Editor, I want the Student View derived automatically by removing teacher-only material, so that I never have to maintain two copies.
82. As an Editor, I want my changes saved continuously and automatically, so that I never lose work.
83. As an Editor, I want to see colleagues' named cursors and selections live while we edit the same Lesson, so that we can collaborate without overwriting each other.
84. As an Editor, I want edits from colleagues to appear in real time without reloading, so that we always work on the latest text.
85. As an Editor, I want to keep working briefly through a lost connection with changes synced when it returns, so that a network hiccup does not lose edits.
86. As a content staff member, I want Approved Lessons to open read-only with a clear banner, so that signed-off content cannot be changed by accident.
87. As a content staff member, I want the original Outline row for the Lesson in a side panel, so that I can check the Lesson against what the designer asked for.
88. As a content staff member, I want Changes Requested reasons shown prominently in the workspace, so that I know what to fix.

### Workflow and approval

89. As an Editor, I want to submit a Draft or Changes Requested Lesson for review, so that an Approver knows it is ready.
90. As an Editor, I want to keep editing a Lesson while it is In Review, so that small fixes do not need a round trip.
91. As an Approver, I want to approve an In Review Lesson, so that it is signed off as ready for students.
92. As an Approver, I want to request changes on an In Review Lesson with a required reason, so that the Editor knows exactly what to fix.
93. As an Approver, I want to Reopen an Approved Lesson back to In Review with a reason, so that late-discovered problems can be fixed.
94. As an Approver, I want to approve even when Quality Checks fail, with that fact recorded, so that a person remains the final judge.
95. As an Approver, I want Self-Approval (approving a Lesson I edited) allowed but clearly recorded, so that small teams are not blocked while four-eyes review stays visible.
96. As a content staff member, I want every status change recorded with who, when and why, so that the approval trail is auditable for state review.
97. As a content staff member, I want only valid status changes offered (for example, no approving a Draft), so that the workflow cannot get into an inconsistent state.
98. As two Approvers acting at the same moment, we want only one conflicting action (for example approve vs. request changes) to succeed and the other to see a clear message, so that a Lesson never ends up in an ambiguous state.

### Versions and history

99. As a content staff member, I want a Lesson Version captured automatically at generation, Regenerate, Submit, Approval and Publish, so that every meaningful state of the Lesson is preserved.
100. As a content staff member, I want a History tab listing versions, Generation Attempts, status changes and accepted AI Suggestions, so that I can see the Lesson's whole story.
101. As a content staff member, I want to compare any two Lesson Versions side by side with changes highlighted, so that I can see exactly what was changed.
102. As a content lead, I want to compare the AI's original against the Approved version, so that I can judge how much human effort the AI saved.
103. As an Editor, I want to restore a previous Lesson Version on a Lesson that is not Approved, creating a new version, so that I can undo a bad direction without rewriting history.

### Quality Checks

104. As a content staff member, I want Rule-Based Quality Checks run on every Lesson and re-run as it is edited, so that structural problems are visible immediately.
105. As a content staff member, I want a check that all Sections required by the Lesson's Type are present, so that no Lesson is missing a part.
106. As a content staff member, I want a check that Activity minutes total 50 (within a tolerance), so that Lessons fit the class period.
107. As a content staff member, I want a check that every Focus Standard is tagged on at least one Activity, so that nothing the Lesson must teach is left out.
108. As a content staff member, I want a check that no unknown standard codes appear in the Lesson, so that tags stay valid after edits.
109. As a content staff member, I want a check that the Lesson's vocabulary matches its Outline row, so that the designer's word list is honoured.
110. As a content staff member, I want a check that Pulse Checks have exactly one correct answer and a rationale for every choice, where the Lesson Type calls for them, so that comprehension checks are usable.
111. As a content staff member, I want a check that each Learning in Action Activity has English-learner support, so that ELD integration is not forgotten.
112. As a content staff member, I want a check that the Student View contains no teacher-only material, so that scripts and answers never leak to students.
113. As a content staff member, I want an AI Review of each Lesson judging, per Focus Standard, whether the tagged Activities genuinely teach the standard's official text, with a one-sentence reason, so that alignment is judged on substance and not just tags.
114. As a content staff member, I want the AI Review to check that the Lesson uses the anchor text pages named in the Outline, so that Lessons stay tied to the text.
115. As an Editor, I want to re-run the AI Review on demand after editing, so that I can confirm my fixes worked.
116. As a content staff member, I want Quality Check results shown as pass, warn or fail badges on the Lesson and on the Unit board, so that attention goes where it is needed.
117. As a content staff member, I want each failing check to point to the place in the Lesson it concerns, so that I can find the problem quickly.

### AI-assisted editing

118. As an Editor, I want to select text or a block and ask the AI to rewrite it following my instruction, so that I can improve passages quickly.
119. As an Editor, I want to ask the AI to add an Integrated ELD panel to an Activity, so that English-learner support is easy to provide.
120. As an Editor, I want a "Fix with AI" action on a failing Quality Check that proposes a specific change, so that I can resolve problems in a click.
121. As an Editor, I want presets to simplify text for reading level, add an Additional Support table, write a sample student response, and add a Pulse Check, so that common editorial tasks are one action.
122. As an Editor, I want every AI change presented as an AI Suggestion with a before/after preview that I accept or reject, so that the AI never changes a Lesson without my agreement.
123. As an Editor collaborating live, I want AI Suggestions visible only to me until I accept them, so that colleagues are not disrupted by text changing under their cursor.
124. As a content staff member, I want accepted AI Suggestions recorded in the Lesson's history with who accepted them, so that AI involvement is transparent.
125. As an Editor, I want AI tools unavailable on Approved Lessons, so that signed-off content stays fixed.

### Publishing

126. As an Approver, I want a Publish action on a Unit once every Lesson is Approved, so that the Unit can be released to teachers.
127. As an Approver, I want a pre-publish summary (Lesson count, Self-Approvals, approvals over failing checks), so that I publish with full awareness.
128. As an Approver, I want Publish to freeze a Unit Release of the current Approved Lesson Versions, so that teachers receive exactly what was signed off.
129. As a content staff member, I want a Published Unit to show Unpublished Changes when any Lesson has been Reopened or edited since the last Release, so that we know a new Release is needed.
130. As an Approver, I want to publish a new Release once the Unit is fully Approved again, so that fixes reach teachers.
131. As a content staff member, I want to download a Unit Release as structured JSON, so that it can be imported into Newsela's product.
132. As an integrating engineer, I want a stable read endpoint for a Unit Release, so that downstream systems can fetch released content.
133. As an integrating engineer, I want a demonstration converter from a released Lesson into Newsela's existing lesson data format, so that the path into the current product is clear.

### Demo, setup and operations

134. As an evaluator, I want to start the whole system locally with one command and no API keys, so that I can explore it in minutes.
135. As an evaluator, I want a pre-generated sample Unit with Lessons in every workflow state, so that every screen has realistic content on first open.
136. As an evaluator, I want to run generation in replay mode from recorded AI responses, so that I can watch the live generation flow without cost.
137. As a developer, I want a fake AI mode for tests, so that the test suite never calls the real API.
138. As a developer, I want optional LangSmith tracing enabled purely through environment settings, so that tracing costs nothing unless I switch it on.
139. As a developer, I want one command that runs linting, type checking and all tests, so that I can verify the codebase before handing it over.
140. As a maintainer, I want the standards data rebuilt by a checked-in script from the published sources, so that adding a grade or refreshing standards is repeatable.

## Implementation Decisions

### Architecture

- A single TypeScript codebase organised as a pnpm workspace with three thin applications and a set of shared packages. No build orchestrator (Turborepo, Nx); the workspace is small enough without one.
- **Web app** (Next.js, React): every screen, plus the HTTP API. Route handlers validate input, resolve the session identity, and call into packages; they hold no domain rules.
- **Worker**: a long-running Node process consuming background jobs (Lesson generation, AI Review). Concurrency is configurable, defaulting to about five Lessons at a time.
- **Collaboration server**: a Hocuspocus (Yjs) server that syncs Lesson documents between browsers, persists them to Postgres, authenticates connections with the session identity, and refuses writes to Lessons that are Approved.
- **Postgres** is the only stateful service: relational data, Yjs document state, Lesson Versions and the job queue. Drizzle defines the schema and migrations.
- Local development and the demo run under Docker Compose. Hosting later is one Fly.io app with three process groups from one image and Neon free-tier Postgres, deployed only after local sign-off.
- Error handling is concentrated at boundaries (API route wrappers, job handlers, one UI error boundary) rather than scattered through the code.

### Modules

- **domain** (pure, no I/O): the Lesson state machine, the permission rules by role, Quality Check rules, Unit publishability and Unit Release rules, Flex Day dependency rules. Interface: functions that take current state plus an actor and an intended action and return either the new state and events, or a typed refusal.
- **lesson-schema** (pure): the canonical Lesson content model in three equivalent forms: a JSON schema used for AI output, a ProseMirror schema used by the editor, and conversion both ways between them. Also derives the Student View and extracts the facts Quality Checks need (Sections, Activities with minutes and standard tags, Pulse Checks, ELD panels, vocabulary).
- **outline**: reads a Unit Outline from CSV or XLSX (or a public Google Sheets link through its CSV export), classifies rows (Lesson, Flex Day, Arc header, Flex header, total), extracts Unit metadata, normalises and expands standard codes, and returns a proposed Unit plus a list of Outline Issues. Interface: one parse function producing an import proposal; one function applying an Editor's issue resolutions to produce the confirmed import.
- **standards**: the built standards dataset (Grade 6 CA CCSS ELA, CA ELD, Model School Library Standards) and lookups by code: exists, official text, parent/children, framework. Also the description-match check used for ELD warnings. Built by a checked-in script from Common Standards Project JSON, corrected where that data is known to be wrong, and verified against the CDE PDFs. Codes are normalised to one canonical form; Media Literacy codes are namespaced to their framework.
- **generation**: builds the prompt for a Lesson (locked instructions, Generation Guidance version, Unit and Arc context, the Lesson's Outline row and its neighbours, official standards text, one example Lesson of the matching Lesson Type, Lesson Digests for Flex Days), calls the model, validates the output against the Lesson JSON schema with one repair attempt, and returns content plus a Generation Attempt record and a Lesson Digest. Also the AI Review and the AI editing actions. Interface: an LLM client abstraction with three modes (live, replay, fake) chosen by environment; optional LangSmith wrapping when enabled by environment.
- **db**: the Drizzle schema, migrations, repositories expressing domain operations as transactions, and the seed loader.
- **queue**: a small job-queue interface (enqueue within a transaction, consume with concurrency, retry with backoff) with a pg-boss implementation, so the queue can be swapped (BullMQ, SQS) by changing one module.

### Data model (conceptual)

- **User**: name, role (Editor or Approver). Seeded; sign-in selects one.
- **Unit**: title, grade, unit number, anchor text (title, author, ISBN), Performance Task, source Outline reference, Outline Issues and their resolutions, publication status (latest Unit Release, Unpublished Changes). The current Generation Guidance is its latest version.
- **Arc**: belongs to a Unit; name, order, description, Performance Task skills.
- **Lesson**: belongs to a Unit and an Arc; position, number, title, Lesson Type, the confirmed Outline row (stored as structured data plus the raw cells), status, Assignee, latest Quality Check results, Lesson Digest.
- **Lesson document**: the live Yjs state of a Lesson, one per Lesson, written by the collaboration server.
- **Lesson Version**: immutable copy of a Lesson's content (as Lesson JSON) with reason (generated, regenerated, submitted, approved, published, restored), actor and time.
- **Workflow event**: an append-only record of each status change, with actor, time, reason, and flags for Self-Approval and approval over failing checks.
- **Generation Guidance version**: Unit, text, author, time.
- **Generation Attempt**: Lesson, Guidance version, extra instructions, model, token usage, cost, duration, outcome, validation errors, raw output.
- **Quality Check result**: Lesson, check, outcome (pass/warn/fail), message, location in the document, time.
- **AI Suggestion record**: Lesson, action, actor, accepted or rejected, time.
- **Unit Release**: Unit, release number, publisher, time, and the Lesson Version included for each Lesson.

### Lesson content model

- A Lesson is one structured document (see ADR 0001). Top-level nodes are fixed and ordered: Lesson header, then the Sections required by the Lesson Type (Launch, Literacy Lab, Learning in Action, Look Back, Homework; Flex Days use Huddles inside Learning in Action).
- Block types inside Sections include: Activity (title, minutes, standard tags), teacher script (Say/Ask/Teach), directions, sample student response, teacher note or tip, Pulse Check (stem, choices, correct choice, rationale per choice), Integrated ELD panel (purpose, say/ask, watch for), Additional Support table, text reference, and ordinary rich text.
- Each block is marked teacher-only or shared. The Student View is the document with teacher-only blocks removed.
- Lesson Type determines the required Sections and their target minutes, as observed in Newsela's published Lessons (typically Launch 5, Literacy Lab 10, Learning in Action 30, Look Back 5 for core Lessons; Spark and Flex Day variants differ).

### Lesson workflow

- States: Outlined, Queued, Generating, Generation Failed, Draft, In Review, Changes Requested, Approved.
- Transitions: Outlined → Queued (start generation; Editor or Approver); Queued → Outlined (cancel generation); Queued → Generating (worker); Generating → Draft or Generation Failed (worker); Generation Failed → Queued (retry); Draft or Changes Requested → In Review (submit; Editor or Approver); In Review → Approved (Approver); In Review → Changes Requested (Approver, reason required); Approved → In Review (Reopen; Approver, reason required); Draft or Changes Requested → Queued (Regenerate; Editor or Approver; confirmation in the UI).
- Editing is allowed in Draft, In Review and Changes Requested; Approved is read-only, enforced by the collaboration server as well as the UI.
- Status changes use optimistic concurrency: each request names the state it expects, and a request based on a stale state is refused with a clear message.
- Approval records Self-Approval (the Approver contributed edits to the Lesson since its last generation) and approval over failing Quality Checks.

### Generation

- Model: Anthropic Claude Sonnet via the official TypeScript SDK, called directly with no agent framework. Generation of one Lesson is one structured call with schema-validated JSON output plus at most one repair call.
- Prompt caching covers the locked instructions, Unit context and example Lessons, which are identical across a Unit.
- Example Lessons come only from Newsela's published Units 1–3 (one per Lesson Type, selected in advance). Published Unit 4 is the Answer Key and never enters a prompt.
- Each Lesson's context includes its Arc, the Performance Task, and the Outline rows (not the generated content) of the previous and next Lessons. Flex Days are queued only when every Lesson in their Arc has content, and include those Lessons' Digests.
- Importing creates Outlined Lessons with no jobs. Starting generation sets Lessons to Queued and enqueues their jobs in one database transaction. Jobs are keyed by Lesson so duplicates are ignored. Progress is written to the database and pushed to open Unit boards.
- Replay mode serves recorded responses keyed by Lesson and attempt, with realistic delays; fake mode serves fixed fixtures for tests. One real run of the sample Unit produces both the seed and the replay recordings.
- The hosted demo restricts live generation to Approvers and enforces a daily Lesson cap.

### AI Review and AI editing

- AI Review is one model call per Lesson after generation and on demand, returning per-Focus-Standard verdicts with reasons and an anchor-text-usage verdict. Results are stored as Quality Check results.
- AI editing actions take the selected block(s) plus Lesson context and return replacement block(s) in the Lesson JSON form. The editor shows them as an AI Suggestion local to the requesting user; accepting applies them as an ordinary edit to the shared document.
- Build order for actions: rewrite with instruction, add ELD panel, Fix with AI, then the remaining presets.

### API surface (contract level)

- Units: list; create from a confirmed import; read with Lessons, Arcs and progress; update Generation Guidance; start generation (all or a selection); cancel generation; publish; list Releases; read a Release; export a Release.
- Outline import: parse a link or file into an import proposal with Outline Issues; confirm with resolutions.
- Lessons: read; transition (submit, approve, request changes, reopen, regenerate with optional instructions, retry); claim or release; list versions; read a version; compare two versions; restore a version; run AI Review; preview prompt.
- AI editing: request a suggestion for an action on given blocks; record the accept/reject outcome.
- Session: list users; sign in as a user; sign out.
- Live updates to the Unit board arrive by server-sent events or polling; Lesson content syncs only through the collaboration server.

### Identity

- Sign-in is a choice of seeded user, stored in a signed cookie, treated as identity supplied by an upstream system. The web app and the collaboration server both verify it. Every action is authorised against the user's role on the server.

## Testing Decisions

- A good test exercises a module through its public interface and asserts on observable behaviour (returned values, persisted state, documents, HTTP responses), never on internal structure. Tests should survive refactoring of internals unchanged.
- No test calls a real model; tests use the fake or replay AI modes.
- The outline parser and the Lesson state machine are written test-first, since their behaviour is fully specified by this PRD and the sample Outline.
- **outline**: tested against the real sample Outline export. Assertions cover row classification (41 Lessons, 6 Flex Days, 4 Arcs, total row), metadata extraction and its contradiction warning, range expansion, and every known quirk producing the expected Outline Issue (non-existent "RL.6.9.a", stray "6.2", ELD description mismatches, filename typos).
- **standards**: lookups, code normalisation, namespace handling, and the known source-data correction.
- **domain**: every allowed and forbidden Lesson transition by role and state, required reasons, Self-Approval and failing-check flags, Unit publishability, Unit Release contents, Flex Day readiness, and each Rule-Based Quality Check against hand-written Lesson documents.
- **lesson-schema**: round-trip conversion between Lesson JSON and the editor document loses nothing, across example Lessons of every Lesson Type; the Student View contains no teacher-only content.
- **generation**: prompt assembly includes the required context and never includes Answer Key material; invalid output triggers exactly one repair; Generation Attempt records are complete. Uses the fake AI client.
- **Integration tests** against a real Postgres in Docker: a confirmed import creates the Unit, Arcs, Outlined Lessons and Generation Guidance v1 together; starting generation queues Lessons and their jobs together; the worker in replay mode takes Lessons from Queued to Draft and creates Lesson Versions and Digests; Flex Days wait for their Arc; stale status changes are refused; the collaboration server refuses edits to an Approved Lesson.
- **One end-to-end browser test** (Playwright) of the main path: import the sample Outline, resolve Outline Issues, generate in replay mode, edit a Lesson in two browser contexts at once and see each other's changes, submit, approve, publish, and download the Release.
- Prior art: the repository is new, so these tests set the patterns. Test fixtures come from the real reference material in the source docs (sample Outline, published example Lessons).
- One command runs lint, type checking, unit, integration and end-to-end tests. There is no CI pipeline for this build; coverage is reported, not enforced.

## Out of Scope

- Real authentication, single sign-on, and user management.
- Publishing directly into Newsela's product; a Release is exported, and a converter to Newsela's lesson data format is demonstrated on common blocks only.
- Generating assessment Lessons (Mid-Unit, End-of-Unit) or assessment items, since the Outline does not ask for them.
- Grades other than Grade 6 and standards frameworks beyond CA CCSS ELA, CA ELD and the Model School Library Standards; the standards build script is the path to add them.
- Generating or sourcing anchor texts and text-set passages; Lessons reference the texts named in the Outline.
- Comments anchored to passages in the editor (threads, resolve); the Changes Requested reason covers the workflow. This is the first addition if time allows.
- A chat-style AI assistant per Lesson.
- Program-level management across the four Units (program planning, cross-Unit pacing).
- Writing changes back to the Google Sheet, or Google OAuth for private sheets.
- Notifications (email, Slack).
- A CI pipeline, and deployment before local sign-off.
- Showing the Answer Key comparison inside the app; it exists as a one-off documented report.

## Further Notes

- **Build order**: foundation (workspace, database, standards, outline import) → editor and collaboration (against a hand-written Lesson) → generation (then one real run of the sample Unit to create the seed and replay recordings) → workflow, versions and publishing → Quality Checks → AI editing → documentation, Answer Key report and end-to-end test. Each phase ends with a code review before the next begins.
- **Cut order if time runs short**: remaining AI presets, the Newsela-format converter, bulk approve, assignment, the AI Review (Rule-Based checks remain), version restore. Never cut: the main path from Outline to Release, live co-editing, import preview with Outline Issues, Lesson Versions on approval, documentation.
- The sample Outline contains real errors (a non-existent standard used four times, a malformed standards cell, 37 ELD entries across nine codes whose descriptions contradict their official meaning). Catching these at import is a deliberate headline capability.
- Standards data derives from the Common Standards Project (CC BY 3.0 US, rights holder D2L) and must be attributed in the documentation.
- Documentation deliverables: README (quickstart and demo walkthrough), architecture (high- and low-level, with sequence diagrams), test plan, deploy (local, Fly.io, and the AWS production path), users, AI usage, decisions, agents, AI log, quality (Answer Key report and per-Unit cost), the glossary, and ADRs.
- The production story (not built) covers: ECS/Fargate, RDS for Postgres, SQS in place of the Postgres queue, SSO, scaling the collaboration server, and an evaluation gate before generation changes ship.
