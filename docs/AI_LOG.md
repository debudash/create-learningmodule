# AI log

Every action taken by an AI agent on this project, newest last. Agents are described in [agents.md](agents.md).

Columns: **When** (date), **Agent** (lead, researcher, slice builder, reviewer, adversary), **Action**, **Output** (files or commit), **Owner input** (what the owner decided or corrected).

| # | When | Agent | Action | Output | Owner input |
|---|---|---|---|---|---|
| 1 | 2026-10-24 | Lead | Cloned the empty GitLab repository into the working folder | `origin` set | Asked to connect the repo |
| 2 | 2026-10-24 | Lead | Stored the project brief verbatim with Markdown headings | `docs/source/project-brief.md` | Provided the brief |
| 3 | 2026-10-24 | Researcher | Downloaded the sample Unit Outline and the linked example Lesson; pulled all 45 published Unit 4 Lessons; summarised Lesson structure | `docs/source/sample-unit-outline/`, `docs/source/example-lessons/` (incl. `STRUCTURE.md`) | n/a |
| 4 | 2026-10-24 | Lead | Ran the design interview (31 questions, one at a time) and recorded terms as they were settled | `GLOSSARY.md`, `docs/adr/0001-…` | Asked for one question at a time; chose local + Fly.io; asked for clean, maintainable code; chose pg-boss after discussing BullMQ; rejected LangSmith by default, then asked for it as an optional env switch; removed CI; gated deployment on local sign-off |
| 5 | 2026-10-24 | Researcher | Located official CA standards sources; identified the "Media Literacy" codes as Model School Library Standards; listed every code in the Outline and flagged invalid or mismatched ones | `docs/source/standards/` | Agreed to a checked-in dataset built by a script |
| 6 | 2026-10-24 | Researcher | Collected all 135 Units 1–3 Lessons and mapped Lesson Types; suggested one example per type | `docs/source/example-lessons/unit{1,2,3}_all/`, `LESSON_TYPES.md` | Agreed Units 1–3 only; Unit 4 is the Answer Key |
| 7 | 2026-10-24 | Lead | Wrote the PRD in the owner's format | `docs/PRD.md` | Provided the format |
| 8 | 2026-10-24 | Lead | Wrote ADRs 0002–0011 and the project documents | `docs/adr/`, `docs/architecture.md`, `users.md`, `deploy.md`, `test_plan.md`, `decisions.md`, `agents.md`, `ai_usage.md`, `AI_LOG.md` | Asked for these documents and the ADR folder format |
| 9 | 2026-10-24 | Lead | Phase 1 spine: pnpm workspace, TypeScript, ESLint, Vitest (unit + integration projects), Docker Compose Postgres; `standards` package interface | commit `d31b74e` | Asked for phase-by-phase build with `/code-review` |
| 10 | 2026-10-24 | Slice builder | Built the standards dataset (174 standards: CCSS-ELA 81, ELD 30, MSLS 63) and its script from CSP JSON, with the PII.6.2 correction and four text fixes checked against the CDE PDFs; normalisation; deterministic ELD description matching (flags all 7 known mismatches plus 5 more) | `packages/standards/` (worktree commit `8b0e6ff`, copied in) | n/a |
| 11 | 2026-10-24 | Lead | Outline parser and import resolution, test-first against the sample Outline; `domain` vocabulary; Drizzle schema, first migration, import repository with integration test | `packages/outline/`, `packages/domain/`, `packages/db/` | n/a |
| 12 | 2026-10-24 | Lead | Found a design gap while building: imported Lessons need a state before generation (trial batches leave the rest ungenerated). Added **Outlined**; cancelling generation returns Queued Lessons to it | `GLOSSARY.md`, PRD, architecture | To confirm |
| 13 | 2026-10-24 | Lead | Corrected two wrong assumptions found by the tests: L3's vocabulary has one bulleted word followed by unbulleted words (rule changed: only sentence-length lines are Designer Notes; the planned "vocabulary split" warning was dropped), and a concatenated filename hides its second Lesson number after a letter | `packages/outline/src/cells.ts`, `parse.ts` | n/a |
