# Lesson Studio: AI Lesson generation, review and approval

Lesson Studio turns an instructional designer's Unit Outline into a full Unit of classroom-ready Grade 6 ELA Lessons for Newsela's California "Core" program, then gives content staff one place to review, co-edit, check, approve and publish them.

1. **Import the Outline.** Paste the Google Sheets link or upload a CSV/XLSX. Every row is checked against the official CA standards (ELA, ELD and the Model School Library Standards). Problems show as Outline Issues to resolve in place before the Unit is created.
2. **Generate.** Each Lesson is written by Claude from its Outline row, its neighbours, the official standard text and one published example Lesson of its type. Editors can tune the shared Generation Guidance and preview the exact prompt. Lessons generate in the background and the board shows progress live. Flex Days wait for the rest of their Arc.
3. **Review and edit together.** Each Lesson is one structured document in a live co-editing editor (ProseMirror + Yjs): named cursors, fixed Section structure, form-like blocks for Pulse Checks, ELD panels and support tables, and a Teacher/Student View toggle.
4. **Check.** Rule-Based Quality Checks run as people type (pacing, Sections, standards, vocabulary, Pulse Checks, ELD support, Student View). An AI Review judges whether each Focus Standard is really taught and whether the Lesson uses the texts its Outline row names.
5. **Improve with AI.** On any Activity, ask for an AI Suggestion: rewrite with an instruction, add ELD support, simplify, add a support table, sample response or Pulse Check. Failing checks offer "Fix with AI". You see a private before/after and accept or reject it.
6. **Approve and publish.** Lessons move Draft, In Review, Approved (or Changes Requested), with Versions, History and Self-Approval flags. Approvers can bulk approve. Publishing freezes a Unit Release, downloadable as JSON or in Newsela's lesson format.

## Run it

Requirements: Docker Desktop. Node 22 and pnpm are only needed for tests and scripts.

```sh
cp .env.example .env
docker compose up --build        # Postgres, setup (migrations + demo seed), web, collab, worker
```

Open http://localhost:3000 and pick a person; there are no passwords. Editors are Maya Chen, Jordan Ellis and Sam Rivera; Approvers are Priya Natarajan and Alex Kim.

The model runs in one of three modes, set with `LLM_MODE` (for example `LLM_MODE=fake docker compose up -d`):

| Mode | What happens | Cost |
|---|---|---|
| `replay` (default) | Serves the recorded live run of the sample Unit (`fixtures/recordings/`). Press "Generate all" on the board to watch it fill in. | $0, no key |
| `fake` | Writes plainly labelled placeholder Lessons, reviews and suggestions. For offline work and the end-to-end tests. | $0, no key |
| `live` | Calls Anthropic (Claude Sonnet 5.5 to generate, Haiku 5.5 to review). Needs `ANTHROPIC_API_KEY` in `.env`; `LLM_RECORD=true` saves the results for replay. | See [QUALITY.md](QUALITY.md) |

In replay mode, AI Suggestions and "Re-check with AI" on edited content report "unavailable", because new text has no recording.

## Tests

```sh
pnpm install
pnpm check                       # lint, typecheck, unit and integration tests (Postgres from Compose)
LLM_MODE=fake docker compose up -d && pnpm db:reset && pnpm test:e2e   # Playwright, against the containers
```

- **Unit tests:** the pure rules (Outline parsing, standards, Lesson schema and conversions, workflow, Quality Checks, prompts).
- **Integration tests:** the database, the queue, the collaboration server and the worker.
- **End-to-end tests:**
  - import, generate all 47 Lessons, review one by hand, bulk approve, publish and download;
  - two people co-editing and an AI Suggestion;
  - a refused accept after a colleague's change.
- **Load test:** `apps/collab/scripts/load-test.ts` simulates 25 reviewers; results are in [QUALITY.md](QUALITY.md).

## How it is built

One TypeScript monorepo (pnpm): a Next.js web app, a Hocuspocus collaboration server and a pg-boss worker, all on one Postgres. No Redis, no agent framework.

```
apps/
  web/        Next.js: sign-in, Units, import wizard, Unit board, Lesson workspace, publishing
  collab/     Hocuspocus server: live co-editing, read-only once Approved, saves through db
  worker/     generation and AI Review jobs (pg-boss)
packages/
  domain/         workflow state machine, roles, Quality Checks, AI Suggestion actions (pure)
  lesson-schema/  Lesson JSON (Zod), ProseMirror schema, conversions, Student View (pure)
  outline/        Outline parsing, Outline Issues, import resolution
  standards/      checked-in CA standards dataset and lookup
  generation/     prompts, model clients (live/replay/fake), generation, AI Review, AI Suggestions
  db/             Drizzle schema and migrations, every read and write of stored state
  queue/          pg-boss jobs, enqueued inside the caller's transaction
  session/        signed session tokens (identity is assumed to come from upstream)
  newsela-format/ export to the shape of Newsela's published lesson objects
fixtures/     the sample Outline, a hand-written Lesson, example Lessons, recordings
e2e/          Playwright end-to-end tests
docs/         PRD, ADRs, architecture, decisions, test plan, logs
```

Start with [docs/architecture.md](docs/architecture.md) for the high- and low-level design and sequence diagrams. The decisions that shape the code are in [docs/adr/](docs/adr/):
- a Lesson is one structured document;
- Postgres is the only state store;
- Hocuspocus/Yjs carries live editing;
- the Anthropic SDK is called directly;
- Unit 4 is held out as an answer key;
- the official standard code wins over the Outline's description;
- a Unit Release freezes the Approved Versions.

All 47 smaller decisions are in [docs/decisions.md](docs/decisions.md). Terms are defined in [GLOSSARY.md](GLOSSARY.md).

## Guards worth knowing

Each guard below has a regression test. The issue IDs are in [docs/ISSUE_LOG.md](docs/ISSUE_LOG.md).

- **Approved Lessons cannot change:**
  - the collaboration server closes editing (LCG-8);
  - forged review actions are refused (LCG-15);
  - AI Suggestions are refused (story 125).
- **Nothing from the browser is trusted:**
  - the import proposal is sealed (LCG-13);
  - review actions are parsed against the workflow (LCG-15);
  - AI Suggestion requests are checked in `db` (`prepareSuggestion`).
- **Lesson and Outline text sent to the model is escaped:** it cannot close the prompt's tags or instruct the reviewer (LCG-24).
- **Concurrent work cannot overwrite itself:**
  - whole-Lesson writes merge with open editors (LCG-7);
  - AI Reviews replace one another in turn (LCG-21);
  - accepting a suggestion refuses if a colleague changed the Activity (LCG-25);
  - late generation results are discarded (LCG-30).
- **Checks never count stale results:** an AI verdict on old content stops counting the moment the content changes (LCG-19, LCG-20).
- **Spend is visible:** every generation, review and suggestion call is recorded with its tokens and cost, and summed on the Unit board.

## AI usage

This project was built with Claude Code. The design interview, phase plan, review loop and every agent action are recorded in [docs/ai_usage.md](docs/ai_usage.md), [docs/agents.md](docs/agents.md) and [docs/AI_LOG.md](docs/AI_LOG.md).

## Known limits

- **Sign-in is a choice of seeded person,** standing in for an upstream identity provider (ADR 0010).
- **Publishing produces an export** in Newsela's lesson format. It does not post into Newsela's product.
- **AI Suggestions work on one whole Activity,** not a selected passage (decision 45).
- **Stored check results can lag a rule change:** when a Rule-Based check changes, results already stored refresh on the Lesson's next edit; the editor always shows current results.
- **Hosting:** runs locally in Docker. The image is ready for Fly.io (ADR 0011) but is not deployed.
