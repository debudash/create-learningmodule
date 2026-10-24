# Deploy

How to run the system locally today, how it will be hosted later, and the production path on AWS.

## 1. Local (the supported path)

Requirements: Docker Desktop, Node 22, pnpm.

| Command | What it does |
|---|---|
| `cp .env.example .env` | Local settings (no secrets needed for the demo) |
| `pnpm db:up` | Starts Postgres in Docker Compose |
| `pnpm db:reset` | Drops, migrates and seeds the database (demo users, sample Unit 4, Lesson 3 as a Draft) |
| `pnpm dev` | Starts `web` (http://localhost:3000), `collab` (ws://localhost:1234) and the generation `worker`, with hot reload |
| `docker compose up` | Planned: the whole stack in containers |
| `pnpm check` | Lint, typecheck, unit, integration and end-to-end tests |

### Environment

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | Compose Postgres | Connection string |
| `SESSION_SECRET` | dev value | Signs the session cookie (web and collab) |
| `LLM_MODE` | `replay` | `live` calls Anthropic; `replay` serves recorded responses; `fake` writes placeholder Lessons from the Outline (offline work, tests) |
| `ANTHROPIC_API_KEY` | unset | Required only for `LLM_MODE=live` |
| `LLM_MODEL` | `claude-sonnet-5-5` | Model for generation, AI Review and AI editing |
| `LLM_EFFORT` | `medium` | How hard the model thinks (`low` to `max`); higher costs more |
| `LLM_RECORD` | `false` | With `LLM_MODE=live`, saves every result under `fixtures/recordings/` for replay |
| `GENERATION_CONCURRENCY` | `5` | Lessons generated at once |
| `GENERATION_DAILY_CAP` | unset (local) | Maximum live-generated Lessons per day (hosted demo) |
| `LANGSMITH_TRACING` | `false` | `true` plus `LANGSMITH_API_KEY` enables tracing |
| `COLLAB_URL` | `ws://localhost:1234` | Where browsers reach the collaboration server |

With the defaults, no secrets are needed: the seeded Unit loads and generation runs in replay mode.

## 2. Hosted demo on Fly.io (planned, not started)

Gate: work starts only after the system is tested locally and the owner gives a go ([ADR 0011](adr/0011-fly-single-app-process-groups.md)).

Plan:
- One Fly app, one Docker image, three process groups: `web` (HTTP), `collab` (WebSocket, separate service port), `worker` (no public port).
- Postgres on Neon's free tier (direct connection string, which pg-boss requires).
- Machines auto-stop when idle; the worker keeps itself running while jobs are queued.
- Secrets: `DATABASE_URL`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`, `GENERATION_DAILY_CAP`.
- Live generation restricted to Approvers and capped per day.
- Release step runs migrations; seed runs once.

## 3. Production path on AWS (story, not built)

| Concern | Demo | Production |
|---|---|---|
| Web and collab | Fly process groups | ECS/Fargate services behind an ALB (sticky WebSocket routing for collab; Hocuspocus Redis extension to scale out) |
| Worker | Fly process group | ECS/Fargate service scaled on queue depth |
| Database | Neon / Compose Postgres | RDS for PostgreSQL, Multi-AZ |
| Queue | pg-boss | SQS (swap behind the queue interface) |
| Identity | Seeded sign-in | SSO (Okta/Google Workspace) via the session module |
| Secrets | env vars | Secrets Manager |
| LLM | Anthropic API | Anthropic API or Bedrock |
| Observability | Generation Attempt records, optional LangSmith | CloudWatch + LangSmith, cost dashboards |
| Quality gate | Manual Answer Key report | An evaluation suite run before any change to prompts or models ships |
