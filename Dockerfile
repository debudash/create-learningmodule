# One image for the whole app (ADR 0011): Compose (and later Fly) runs it as
# three processes, web, collab and worker, each with its own command.
FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY . .
# The pnpm store is cached between builds, so rebuilding after a code change is quick.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

# The browser connects to the collaboration server at this address; Next.js
# builds it into the page, so it is fixed at build time.
ARG NEXT_PUBLIC_COLLAB_URL=ws://localhost:1234
ENV NEXT_PUBLIC_COLLAB_URL=$NEXT_PUBLIC_COLLAB_URL
# Building loads the server modules, which create the (lazy) database pool; no
# query runs at build time, so a placeholder address is enough.
RUN DATABASE_URL=postgres://build-placeholder/lcg pnpm --filter @lcg/web build

ENV NODE_ENV=production
CMD ["sh", "docker/start.sh"]
