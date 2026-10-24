# Lesson Content Generation

The internal tool Newsela content staff use to turn a Unit Outline into AI-generated Lessons, then review, edit, approve and publish them as a Core curriculum Unit.

## Language

### Curriculum

**Unit**:
One of the four sequential blocks of a year-long Core program, made up of ~40–47 Lessons built around a shared anchor text and Performance Task.
_Avoid_: Module, course

**Lesson**:
One ~50-minute day of classroom instruction within a Unit, aligned to specific CA ELA/ELD standards.
_Avoid_: Day, class, session

**Arc**:
A named, ordered stretch of Lessons within a Unit (e.g. Spark, Investigation 1, Investigation 2, Showcase) that shares a purpose and builds toward the Performance Task.
_Avoid_: Section, phase, module

**Performance Task**:
The culminating assessed project of a Unit, which its Lessons build the skills for.
_Avoid_: Final project, capstone

**Lesson Type**:
The instructional pattern a Lesson follows (e.g. Spark, Core Reading, Core Writing, Academic Discussion, Flex Day), which determines its section structure.
_Avoid_: Template, format, kind

**Flex Day**:
A Lesson at the end of an Arc for reteaching and catching up, built from small-group Huddles rather than new content.
_Avoid_: Buffer day, review day

**Unit Outline**:
The instructional design for a Unit, authored by an instructional expert as a spreadsheet with one row per Lesson; the input to generation.
_Avoid_: Spreadsheet, sheet, scope and sequence

**Section**:
One of the fixed, timed parts of a Lesson, in order: Launch, Literacy Lab, Learning in Action, Look Back, Homework (which Sections appear depends on the Lesson Type).
_Avoid_: Part, phase, step

**Activity**:
A single timed classroom task inside a Section, tagged with the standards it teaches.
_Avoid_: Task, exercise, routine

**Pulse Check**:
A quick in-lesson comprehension question with the correct answer and a rationale for each choice.
_Avoid_: Quiz, check for understanding

**Teacher View**:
The complete Lesson as a teacher sees it, including scripts, sample responses, timings and support notes.
_Avoid_: Teacher edition, TE

**Student View**:
The Lesson as students see it: the Teacher View with all teacher-only material removed.
_Avoid_: Student edition, student copy

**Outline Issue**:
A problem found in a Unit Outline at import, either Blocking (e.g. a standard code that does not exist) or a Warning (e.g. a code whose description does not match its official text).
_Avoid_: Error, validation failure

**Designer Note**:
Guidance an instructional expert left inside a Unit Outline cell, addressed to whoever writes the Lesson rather than to students.
_Avoid_: Comment, remark

**Focus Standard**:
A CA ELA/ELD standard that a Lesson explicitly teaches and assesses.
_Avoid_: Primary standard, assessed standard

**Supporting Standard**:
A CA standard a Lesson touches on and reinforces without assessing it.
_Avoid_: Additional standard, secondary standard

**ELD Standard**:
A California English Language Development standard addressed by a Lesson's supports for English learners.
_Avoid_: ELL standard, language standard

**Media Literacy Standard**:
A standard from California's Model School Library Standards (Grade Six), written in Unit Outlines as codes like "2.1.a".
_Avoid_: Library standard, MLS

### Quality

**Quality Check**:
An automated assessment of a Lesson that passes, warns or fails, either Rule-Based (structure, pacing, tagging) or an AI Review (whether content genuinely teaches its standards); it informs but never blocks Approval.
_Avoid_: Validation, test, lint

**AI Suggestion**:
A change to a Lesson proposed by AI during editing that only takes effect when a person accepts it.
_Avoid_: AI edit, autocomplete

**Answer Key**:
Newsela's own published version of a Unit, held back from generation and used only to compare generated Lessons against.
_Avoid_: Ground truth, gold set, reference unit

### People

**Editor**:
A content staff member who uploads Unit Outlines, generates Lessons, and edits them for review.
_Avoid_: Author, reviewer, writer

**Approver**:
A lead content staff member who signs off Lessons, Reopens them, and Publishes Units; an Approver can also do everything an Editor does.
_Avoid_: Admin, lead, reviewer

**Assignee**:
The Editor who has claimed a Lesson as their responsibility; others may still edit it.
_Avoid_: Owner, author

**Self-Approval**:
An Approval given by an Approver who also edited that Lesson; permitted, but always recorded as such.
_Avoid_: Auto-approval

### Workflow

**Generation Failed**:
The state of a Lesson whose AI generation did not produce valid content; it can be retried.
_Avoid_: Error, broken

**Draft**:
The state of a Lesson whose content exists and is being worked on by an Editor, not yet submitted for sign-off.
_Avoid_: Generated, pending

**Generation Guidance**:
Plain-language instructions an Editor writes for a Unit to steer how its Lessons are generated (tone, pacing, teaching preferences); versioned, and recorded on every Lesson it produced.
_Avoid_: Prompt, system prompt, instructions

**Generation Attempt**:
One AI generation run for a Lesson, recording the Generation Guidance version, extra instructions, outcome and cost.
_Avoid_: Run, job, call

**Lesson Digest**:
A short summary of a generated Lesson (key activities, vocabulary taught, standards covered) that later Lessons in its Arc, such as Flex Days, build on.
_Avoid_: Summary, recap

**Regenerate**:
Replacing a Draft Lesson's content with a fresh AI generation; the previous content is kept in its history.
_Avoid_: Retry, redo

**In Review**:
The state of a Lesson submitted by an Editor and awaiting an Approver's decision.
_Avoid_: Submitted, pending approval

**Changes Requested**:
The state of a Lesson an Approver has sent back to Editors with a stated reason.
_Avoid_: Rejected, returned

**Approved**:
The state of a Lesson that has been reviewed and signed off as ready for students.
_Avoid_: Finalized, complete, done

**Reopen**:
Returning an Approved Lesson to review because it needs further change.
_Avoid_: Unapprove, reject

**Published**:
The state of a Unit whose Approved Lessons have been released to Newsela's product; a Unit, never a single Lesson, is Published.
_Avoid_: Released, live, finalized

**Lesson Version**:
A frozen copy of a Lesson's content captured at a workflow moment (generation, Regenerate, Submit, Approval, Publish), never modified afterwards.
_Avoid_: Revision, snapshot, draft

**Unit Release**:
The frozen set of Approved Lesson Versions that a Unit's Publication makes available to teachers.
_Avoid_: Build, export, edition

**Unpublished Changes**:
The condition of a Published Unit in which at least one Lesson has been Reopened or edited since the Unit was last Published.
_Avoid_: Dirty, out of sync
