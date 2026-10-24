# One TypeScript pnpm workspace: three thin apps over pure shared packages

The system is one TypeScript codebase organised as a pnpm workspace: three applications (Next.js web app, background worker, Hocuspocus collaboration server) over shared packages, with all domain rules in packages that do no I/O (`domain`, `lesson-schema`). The brief allows Python, but one language lets the lesson schema, standards lookups and workflow rules be shared verbatim by the generator, the editor, the API and the collaboration server.

## Considered Options

- **Next.js + Python (FastAPI) for generation**: a second toolchain and a duplicated lesson schema, with nothing the Anthropic TypeScript SDK cannot do.
- **Turborepo / Nx**: unnecessary for three apps and seven packages; plain pnpm workspaces keep the repository readable.

## Consequences

- Apps must stay thin: a domain rule found in an app instead of a package is a review finding.
