# Postgres is the only stateful service, including the job queue (pg-boss)

All state lives in Postgres: relational data, Yjs document state, Lesson Versions and background jobs (pg-boss). Creating Lessons and enqueueing their generation jobs happens in one transaction, so a Lesson can never be recorded without being queued or queued without being recorded, and the demo needs no Redis. The queue sits behind a small interface so BullMQ or SQS can replace pg-boss by changing one module.

## Considered Options

- **Redis + BullMQ**: better dashboards and a shared rate limiter, but an extra service, and job state held apart from lesson state needs reconciliation code. The load (~47 jobs per Unit) does not justify it.
- **SQLite**: three processes writing concurrently and "20+ reviewers" make it the wrong story.
- **Generation inside API routes**: multi-minute requests time out and are killed by deploys.
