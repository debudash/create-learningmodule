---
status: proposed
---

# Host on Fly.io as one app with three process groups and Neon Postgres, after local sign-off

The hosted copy will be one Fly.io app built from one image with `web`, `worker` and `collab` process groups, using Neon's free tier for Postgres and auto-stopping idle machines, to keep hosting cost in single digits per month. Vercel was rejected because it cannot host long-lived websockets or multi-minute jobs. Deployment work starts only after the system is tested locally and the owner gives a go; until then only the Dockerfile is kept deploy-ready.
