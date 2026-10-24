# Decisions

Every design decision made while scoping this project (design interview, 2026-10-24), in the order it was made. Decisions that are hard to reverse have an ADR in [adr/](adr/); the rest are recorded only here.

| # | Topic | Decision | Why | ADR |
|---|---|---|---|---|
| 1 | Purpose | Hiring submission for Newsela; optimise for clean architecture and one complete path (outline → generate → edit → approve → publish) | Reviewers read code and docs and try the app | |
| 2 | Hosting | Local first with Docker Compose; Fly.io later, only after local sign-off | Low cost; a live link for reviewers once stable | [0011](adr/0011-fly-single-app-process-groups.md) |
| 3 | Language and shape | One TypeScript pnpm workspace: web, worker, collab apps over shared packages | One language, one shared lesson schema; clean and maintainable | [0002](adr/0002-typescript-pnpm-monorepo.md) |
| 4 | Database | Postgres with Drizzle | Concurrent writers, 20+ reviewers, queue in the same database | [0003](adr/0003-postgres-only-state-and-pg-boss-queue.md) |
| 5 | Collaboration | Full live co-editing: Tiptap + Yjs + Hocuspocus; Approved is read-only | The reason the brief names Yjs | [0004](adr/0004-hocuspocus-yjs-live-collaboration.md) |
| 6 | Background jobs | pg-boss behind a small queue interface (BullMQ considered) | No extra service; transactional enqueue | [0003](adr/0003-postgres-only-state-and-pg-boss-queue.md) |
| 7 | LLM | Anthropic TypeScript SDK directly, Claude Sonnet; LangSmith optional by environment; Generation Attempt records; prompt caching; replay and fake modes | One structured call per task; spend control | [0005](adr/0005-direct-anthropic-sdk-no-agent-framework.md) |
| 8 | Identity | Seeded sign-in, identity trusted, role checked on the server | Auth solved upstream | [0010](adr/0010-identity-supplied-upstream.md) |
| 9 | Vocabulary | Approved = finalized = complete; Published applies to a Unit; Reopen returns to In Review | The brief used four words for one state | |
| 10 | Roles | Editor and Approver; Self-Approval allowed and recorded | Matches the brief's staff; demo flows solo | |
| 11 | Lesson workflow | Queued → Generating → Draft → In Review → Approved; Changes Requested with required reason; Generation Failed; Regenerate only from Draft or Changes Requested | Clear, auditable sign-off | |
| 12 | Which rows are Lessons | Lesson rows and Flex Day rows (47); Arcs modelled; assessments out of scope | The Outline counts Flex Days as instruction | |
| 13 | Outline input | Google Sheets link or CSV/XLSX upload, then an import preview with Outline Issues | Catch errors before spending on generation | |
| 14 | Standards source | Checked-in dataset built by a script from CSP JSON, verified against CDE PDFs | Exact, offline, deterministic | [0006](adr/0006-checked-in-standards-dataset.md) |
| 15 | Lesson storage | One structured ProseMirror document per Lesson; Student View derived | Structural checks while co-editing; no drifting copies | [0001](adr/0001-lesson-as-one-structured-document.md) |
| 16 | Few-shot examples | Units 1–3 only, one per Lesson Type; Unit 4 is the Answer Key | Prevent copying; honest evaluation | [0007](adr/0007-unit-4-held-out-as-answer-key.md) |
| 17 | Outline vs official standards | Official code wins; non-existent codes block import; description mismatches warn | Codes go to state review; humans decide intent | [0008](adr/0008-official-standard-code-wins.md) |
| 18 | Prompt editing | Locked prompt + editable, versioned Generation Guidance; per-Regenerate instructions; prompt preview | Control without breaking the format | |
| 19 | Cross-lesson coherence | Parallel generation with Arc context and neighbouring Outline rows; Flex Days wait for their Arc and use Lesson Digests | Speed without losing continuity | |
| 20 | Quality | Rule-Based checks (per Lesson Type) + AI Review; never blocks approval; Answer Key report offline | Directs reviewer attention; human is the judge | |
| 21 | AI editing | Toolbar actions and Fix with AI, delivered as AI Suggestions accepted or rejected locally | No text changing under colleagues' cursors | |
| 22 | Screens | Units, New Unit wizard, Unit board, Lesson workspace, Publish; optional assignment; Answer Key not in the app | Easy-to-navigate workflow | |
| 23 | Versions | Lesson Versions at workflow moments; compare any two; restore creates a new version; Publish freezes a Unit Release | "Approved" means a specific text | [0009](adr/0009-unit-release-freezes-approved-versions.md) |
| 24 | Publish output | Our own JSON export + read endpoint; Newsela-format converter demonstrated on common blocks | Honest about an unknown internal format | |
| 25 | Demo data | Seeded sample Unit across every state; replay mode from one real recorded run | Explore in 30 seconds with no key or cost | |
| 26 | Testing | Vitest unit + integration, one Playwright main path; no CI | Evidence of judgment within the time box | |
| 27 | Documentation | README, architecture, test plan, deploy, users, AI usage, decisions, agents, AI log, glossary, ADRs | Required deliverable | |
| 28 | Fly topology | One app, three process groups, Neon free tier, auto-stop | Cheapest workable hosting | [0011](adr/0011-fly-single-app-process-groups.md) |
| 29 | Build order | Foundation → editor → generation → workflow → quality → AI editing → docs; cut list defined | Prove the riskiest piece (editor + Yjs) before spending on generation | |
| 30 | Layout | Folder layout in [architecture.md](architecture.md); pure `domain` and `lesson-schema` | Rules testable without I/O | [0002](adr/0002-typescript-pnpm-monorepo.md) |
| 31 | Anchored comments | Not built; lesson-level reason only; first addition if time allows | Budget | |
