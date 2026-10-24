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
