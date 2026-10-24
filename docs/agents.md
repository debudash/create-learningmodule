# Agents

How AI coding agents build this project in slices. Every agent action is recorded in [AI_LOG.md](AI_LOG.md); how AI is used overall is in [ai_usage.md](ai_usage.md).

## Roles

| Agent | Runs as | Does | Does not |
|---|---|---|---|
| **Lead** | The main Claude Code session | Owns the plan, writes the spine (workspace, schemas, interfaces) itself, briefs and merges slice builders, runs reviews, decides fixes, commits | Hand off decisions the owner made |
| **Slice builder** | Sub-agent, own git worktree | Builds one slice against a written brief, test-first where the test plan says so, and returns a summary with the tests it ran | Change shared interfaces, schemas or ADRs; commit to the phase branch |
| **Researcher** | Sub-agent, read-only on the codebase | Gathers facts from reference material and the web into `docs/source/` | Make design decisions |
| **Reviewer** | `/code-review` (two parallel sub-agents: Standards and Spec) | Reviews each phase's changes against the repo's standards and against the PRD | Edit code |
| **Adversary** | `agent-adversary` sub-agent, after the final phase | Attacks the running system (permissions, read-only enforcement, prompt injection via Outline cells, Answer Key leakage) and reports reproducible breaks | Fix what it finds |

## When to use a slice builder

Only when a slice is independent of the work in progress: it touches its own package, depends only on interfaces that already exist on the phase branch, and can be tested on its own. Examples: the standards build script, the outline parser against its fixture, the editor's custom block views. Anything that changes a shared interface (lesson schema, database schema, queue interface, domain types) is done by the lead, in sequence.

## Phase loop ("grind")

For each build phase in the PRD's build order:

1. **Plan.** The lead lists the phase's slices, marks which are independent, and writes a brief for each delegated slice (goal, files and interfaces in scope, tests that must pass, what is out of bounds).
2. **Build.** The lead builds shared pieces first; slice builders run in parallel on independent slices; the lead merges.
3. **Verify.** `pnpm check` passes.
4. **Review.** `/code-review` against the commit the phase started from.
5. **Fix.** The lead fixes or explicitly rejects each finding (with the reason in AI_LOG.md); bugs follow the bug-fix rules below.
6. **Commit and log.** One commit per phase on the build branch, then an AI_LOG.md entry.

The next phase starts only when the review has no unresolved findings.

## Rules every agent follows

- Use the vocabulary in [GLOSSARY.md](../GLOSSARY.md); no synonyms in code, UI or docs.
- Follow the ADRs; a change that contradicts one stops and goes to the lead.
- Keep `domain` and `lesson-schema` free of I/O; keep apps thin.
- Match surrounding code style and comment density.
- No real model calls in tests; never put Answer Key (published Unit 4) material in a prompt or a fixture used by generation.
- Bug fixes: a failing test first; a comment at the fix site with the issue ID, the cause and why the fix works; a commit message with `Issue:`, `Root cause:`, `Fix:` and `Test:` parts.
- No attribution trailers in commits unless the owner approves them.
- Never push, deploy or provision hosting without the owner's go.
