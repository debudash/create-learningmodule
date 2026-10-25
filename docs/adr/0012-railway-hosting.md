---
status: accepted
---

# Host the demo on Railway: three services from one image, Railway Postgres, replay mode

The hosted copy runs on Railway as one project:
- **Services:** `web`, `collab` and `worker`, all built from the repository's Dockerfile. Each picks its process with `LCG_PROCESS`.
- **Database:** Railway's own Postgres.
- **Model:** replay mode, so the recorded live run of the sample Unit is served with no API key and no cost.

Fly.io (ADR 0011) was set aside before any work started. It needed a separate Neon database, and its free shared IP gives only one public HTTPS port, so the collaboration server would have needed a second app or a paid IP. Railway gives every service its own HTTPS domain and has Postgres built in. The owner already had an active Railway plan.

## Consequences

- **Addresses:**
  - web at `lesson-studio.up.railway.app`;
  - the collaboration server at `lesson-studio-collab.up.railway.app`, reached by browsers over `wss`;
  - the web app reaches collab privately at `collab.railway.internal`, so collab listens on `::`.
- **Database setup:** the web process applies migrations and seeds an empty database on start (`packages/db/src/setup.ts`). Existing data is kept.
- **Deploys** are pushed from the CLI (`railway up --service <name>`), because Railway deploys only GitHub repositories automatically and the repository is on GitLab. The collaboration URL is built into the web app, so changing it means rebuilding web.
- **No BuildKit cache mount:** Railway's builder refuses the standard form, and it refuses dependencies with known vulnerabilities, which is why Next.js was upgraded to 15.1.11.
- **Replay limits:** AI Suggestions and AI Reviews of edited content are unavailable on the hosted copy. Live mode would need `ANTHROPIC_API_KEY` and is capped by `LIVE_GENERATION_APPROVERS_ONLY` and `GENERATION_DAILY_CAP`.
- **Cost:** services stay running, so hosting is the Railway Hobby plan's usage (about $5–10 a month).
