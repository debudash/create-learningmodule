#!/bin/sh
# Which process this container runs. Hosting that starts every service from the
# same image (Railway) sets LCG_PROCESS per service; docker-compose.yml gives
# each service its own command instead.
set -e
case "${LCG_PROCESS:-web}" in
  web)
    # Migrations, and the demo seed into an empty database, before serving.
    (cd packages/db && pnpm exec tsx src/setup.ts)
    exec pnpm --filter @lcg/web start
    ;;
  collab) cd apps/collab && exec pnpm exec tsx src/main.ts ;;
  worker) cd apps/worker && exec pnpm exec tsx src/main.ts ;;
  *) echo "Unknown LCG_PROCESS: $LCG_PROCESS (expected web, collab or worker)" >&2; exit 1 ;;
esac
