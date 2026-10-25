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
| 32 | ELD description check | Deterministic word matching against the official item text instead of an AI call at import | Free, instant, testable, works without an API key; calibrated on the sample's 117 ELD entries and pinned by a test | |
| 33 | Outlined state | Imported Lessons start Outlined; starting generation queues them; cancelling returns them to Outlined | Trial batches leave the rest ungenerated (gap found while building) | |
| 34 | Block audience | Teacher-only is fixed by block type; only paragraphs choose | A sample answer can never leak to students by a wrong flag | |
| 35 | Changes made outside the editor | Whole-Lesson replacements are Yjs changes plus a Postgres NOTIFY; status changes reconnect open editors; collaboration saves merge with what is stored | Open editors, Regenerate and Restore can never overwrite each other | [0004](adr/0004-hocuspocus-yjs-live-collaboration.md) |
| 36 | Offline editing | Browser keeps the document in IndexedDB; a status pill shows Saved / Saving / Offline | Story 85; CRDT merge makes it safe | |
| 37 | Model call settings | Claude Sonnet 5.5 via the beta Messages endpoint, streamed, effort `medium` by default, server-side refusal fallback `fallbacks: "default"`. Generation asks for JSON described by the schema in the cached prompt and validates it (the whole-Lesson schema is too large for structured outputs, LCG-28); the AI Review and AI Suggestions use structured outputs | Cost-aware default with a quality lever; a classifier decline is retried on Anthropic's recommended model instead of failing a Lesson; validation plus one repair keeps output well-formed | [0005](adr/0005-direct-anthropic-sdk-no-agent-framework.md) |
| 38 | Few-shot examples at runtime | The build script writes the rendered examples into the generation package as JSON, so prompts need no file reads | Works the same in the worker and in the web app's prompt preview | [0007](adr/0007-unit-4-held-out-as-answer-key.md) |
| 39 | Versions at Publish | Publishing captures no new Versions; a Unit Release points at each Lesson's latest Approved Version | The Approved Version is the published text; a copy would add nothing | [0009](adr/0009-unit-release-freezes-approved-versions.md) |
| 40 | Newsela-format export | Release download in our JSON, plus `?format=newsela` converting each Lesson to the shape of Newsela's published lesson objects (common blocks; unmapped items listed) | Shows the path into Newsela's product without claiming their internal contract | |
| 41 | Where Quality Checks run | Rule checks are one pure function: run live in the browser while editing, and stored whenever content is stored (so stored results are always current); the AI Review runs after generation and on demand | Instant feedback for Editors; the board and approval read current results | |
| 42 | AI Review model | Claude Haiku 5.5 by default (`LLM_REVIEW_MODEL`) | Judging alignment against given standard text is a cheaper task than writing the Lesson | |
| 43 | Which results count | Every stored content carries a digest; each Quality Check result records the digest it judged, and only results matching the stored content count on the board, in filters and in the approval warning. An AI Review of an earlier draft stays visible as such | Edits, restores and regenerates can never leave a stale verdict counting, and a slow review cannot overwrite a newer one | [0005](adr/0005-direct-anthropic-sdk-no-agent-framework.md) |
| 44 | AI Review in replay mode | Replay serves a review only for content it has a recording of (key includes the content digest); otherwise the review is recorded as unavailable and not retried | Never shows a verdict recorded for different text; never loops on retries | [0005](adr/0005-direct-anthropic-sdk-no-agent-framework.md) |
| 45 | What an AI Suggestion changes | One whole Activity, returned as Lesson JSON with the same id; the request carries the Activity as the Editor sees it, and the Lesson as context | Activities are the unit Editors think in and checks point at; a whole Activity validates against the schema, where a text span would not | |
| 46 | Accepting an AI Suggestion | Refused in the browser if the Activity changed since the request; recorded on the server (which refuses Approved Lessons) before the editor applies it as an ordinary edit | Never overwrites a colleague's newer change; the record and the change cannot disagree | |
| 47 | AI Suggestions by mode | Live uses `LLM_MODEL`; fake adds a labelled placeholder block; replay reports "unavailable" (edits cannot be recorded in advance) | The demo and tests run without a key; nothing pretends to be AI output | [0005](adr/0005-direct-anthropic-sdk-no-agent-framework.md) |
