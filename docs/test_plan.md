# Test plan

What is tested, how, and when. Principles come from the Testing Decisions in [PRD.md](PRD.md).

## Principles

- Test behaviour through public interfaces; never assert on internals. A refactor that keeps behaviour must not break a test.
- No test calls a real model. The LLM client runs in `fake` (fixed fixtures) or `replay` (recorded responses) mode.
- Fixtures are real reference material: the sample Outline export and Newsela's published Lessons from Units 1–3. The Answer Key (Unit 4) is used only by the comparison report.
- Test-first for the outline parser, the Lesson state machine, and every bug fix (each bug-fix test carries its issue ID and a one-line "found by" note).
- One command, `pnpm check`, runs everything. No CI pipeline; coverage is reported, not enforced.

## Layers

| Layer | Tool | Runs against | Scope |
|---|---|---|---|
| Unit | Vitest | Pure packages | `domain`, `lesson-schema`, `outline`, `standards`, `generation` (fake client) |
| Integration | Vitest | Real Postgres in Docker | Repositories, transactions, worker in replay mode, collab server guard |
| End-to-end | Playwright | Full stack, replay mode | One main-path scenario with two browser contexts |
| Report | Script | Live model, run by hand once | Answer Key comparison and cost per Unit (written into the docs) |

## Coverage by module

### outline
- Classifies the sample Outline: 41 Lessons, 6 Flex Days, 4 Arcs, total row = 47 days, no rows lost.
- Extracts Unit metadata (grade 6, Unit 4, *The Lightning Thief*, ISBN) and warns that filenames say U3.
- Expands ranges (`W.6.3.a–e` → five codes; en-dash and hyphen).
- Blocking issues: `RL.6.9.a` (four Lessons), the stray `6.2` in Lesson 4.
- Warnings: each ELD code whose description contradicts its official text, with the suggested code.
- Preserves Designer Notes; handles bullet characters and multi-line cells.
- Applying resolutions clears issues; confirm is refused while Blocking issues remain.

### standards
- Every code used by the sample Outline resolves (after resolution of known issues).
- Normalisation (`W.6.3a` ≡ `W.6.3.a`), Media Literacy namespace, ELD lookups returning all proficiency levels.
- The known source-data correction (ELD Part II item 2) is applied.

### domain
- Every allowed transition by role and state; every forbidden one refused with a typed reason.
- Reasons required for request changes and Reopen.
- Self-Approval and approval-over-failing-checks flags.
- Optimistic concurrency: a stale expected state is refused.
- Unit publishability; Release contents point at Approved Versions; Unpublished Changes after Reopen.
- Flex Day readiness (all Lessons in the Arc have content).
- Each Rule-Based Quality Check, pass and fail, on hand-written Lesson documents, per Lesson Type.

### lesson-schema
- Round trip Lesson JSON → document → Lesson JSON is lossless for an example of every Lesson Type.
- Student View contains no teacher-only block.
- Structural constraints: required Sections cannot be removed or reordered.

### generation
- Prompt contains: locked instructions, the matching Lesson Type example, Unit and Arc context, neighbouring rows, official standards text, the Guidance version, Designer Notes; Flex Days include Digests.
- Prompt never contains Answer Key material.
- Invalid output triggers exactly one repair; a second failure is reported.
- Generation Attempt records include model, tokens, cost, duration and outcome.

### Integration
- Confirming an import creates Unit, Arcs, Lessons and Guidance v1 in one transaction.
- Starting generation queues jobs and sets Lessons to Queued atomically; a duplicate start does not duplicate jobs.
- Worker (replay) takes a Lesson Queued → Generating → Draft and writes document, Version, attempt and Digest.
- Flex Days are enqueued only when their Arc is complete.
- A failing job is retried, then marks the Lesson Generation Failed.
- The collaboration server refuses an update to an Approved Lesson and accepts it after Reopen.

### End-to-end (Playwright)
1. Sign in as an Editor; import the sample Outline; resolve the Outline Issues; confirm.
2. Generate in replay mode; watch the board reach Draft.
3. Open one Lesson in two browser contexts; type in one and see it in the other.
4. Accept an AI Suggestion.
5. Submit; switch to an Approver; approve; confirm the editor is read-only.
6. Approve the rest in bulk; publish; download the Release.

## Exit criteria per build phase

- `pnpm check` passes.
- `/code-review` against the phase's starting point has no unresolved findings.
- New behaviour from the phase is covered at the lowest layer that can observe it.
