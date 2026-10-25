# Deploy

How to run the system locally today, how it will be hosted later, and the production path on AWS.

## 1. Local (the supported path)

Requirements: Docker Desktop; Node 22 and pnpm only for running tests and scripts.

Every service runs in Docker Compose: one image (`Dockerfile`, as on Fly per ADR 0011) started as `web`, `collab` and `worker`, plus Postgres and a one-shot `setup` service.

| Command | What it does |
|---|---|
| `cp .env.example .env` | Local settings (no secrets needed for the demo) |
| `docker compose up --build` | Builds the image and starts Postgres, `setup` (migrations; seeds the demo into an empty database), `web` (http://localhost:3000), `collab` (ws://localhost:1234) and the generation `worker` |
| `LLM_MODE=fake docker compose up -d` | The same with placeholder Lessons and AI output (offline work, end-to-end tests); `LLM_MODE=live` calls Anthropic |
| `pnpm db:reset` | Drops, migrates and seeds the database again (runs on the host against the Compose Postgres) |
| `pnpm check` | Lint, typecheck, unit and integration tests (on the host) |
| `pnpm test:e2e` | Playwright end-to-end tests against the running containers (fake mode, freshly reset database) |

Rebuild the image (`docker compose up --build`) after code changes; there is no hot reload in the containers.

### Environment

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | Compose Postgres | Connection string |
| `SESSION_SECRET` | dev value | Signs the session cookie (web and collab) |
| `LLM_MODE` | `replay` | `live` calls Anthropic; `replay` serves recorded responses; `fake` writes placeholder Lessons from the Outline (offline work, tests) |
| `ANTHROPIC_API_KEY` | unset | Required only for `LLM_MODE=live` |
| `LLM_MODEL` | `claude-sonnet-5-5` | Model for generation and AI editing |
| `LLM_REVIEW_MODEL` | `claude-haiku-5-5` | Model for the AI Review (a judging task, so a cheaper model) |
| `LLM_EFFORT` | `medium` | How hard the model thinks (`low` to `max`); higher costs more |
| `LLM_RECORD` | `false` | With `LLM_MODE=live`, saves every result under `fixtures/recordings/` for replay |
| `GENERATION_CONCURRENCY` | `5` | Lessons generated at once |
| `GENERATION_DAILY_CAP` | unset (local) | Maximum Lessons sent to the live model per day (hosted demo) |
| `LIVE_GENERATION_APPROVERS_ONLY` | `false` | `true` lets only Approvers start live generation (hosted demo) |
| `LANGSMITH_TRACING` | `false` | `true` plus `LANGSMITH_API_KEY` enables tracing |
| `COLLAB_URL` | `ws://localhost:1234` | Where browsers reach the collaboration server |

With the defaults, no secrets are needed: the seeded Unit loads and generation runs in replay mode.

## 2. Hosted demo on Railway

Live at **https://lesson-studio.up.railway.app** (replay mode). Pick a person to sign in. [ADR 0012](adr/0012-railway-hosting.md) explains the choice.

| Service | What it runs | Address |
|---|---|---|
| `web` | `LCG_PROCESS=web`: migrations and the demo seed into an empty database, then Next.js on :3000 | https://lesson-studio.up.railway.app |
| `collab` | `LCG_PROCESS=collab`: Hocuspocus on :1234, listening on `::` | wss://lesson-studio-collab.up.railway.app, and `collab.railway.internal` privately |
| `worker` | `LCG_PROCESS=worker`: generation and AI Review jobs | no public address |
| `Postgres` | Railway Postgres | private only |

Variables (set per service; values are not in the repository):
- **All three services:** `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `SESSION_SECRET` (the same value in all three) and `LLM_MODE=replay`.
- **web only:** `COLLAB_URL=ws://collab.railway.internal:1234` and `NEXT_PUBLIC_COLLAB_URL=wss://lesson-studio-collab.up.railway.app` (built into the page, so changing it means rebuilding web).
- **collab only:** `COLLAB_HOST=::` and `COLLAB_PORT=1234`.

Redeploy after a change with `railway up --service <web|collab|worker> --detach`, run from the repository root.

To reset the hosted demo:
1. Run `railway ssh --service web -- sh -c "cd /app/packages/db && pnpm exec tsx src/seed.ts"`.
2. Sign in, open the Unit, and press "Generate all". Replay restores the recorded Unit for free.

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
