# Live co-editing through a dedicated Hocuspocus (Yjs) server that enforces read-only on Approved Lessons

Lessons are edited with Tiptap (ProseMirror) bound to a Yjs document synced by a separate Hocuspocus server, which authenticates each connection with the session identity, persists document state to Postgres, and refuses updates to Approved Lessons. The brief mandates ProseMirror and Yjs; a dedicated server gives real multi-user editing with presence, and keeps the read-only rule enforced on the server rather than only in the UI.

## Considered Options

- **Yjs as a document format only, saved through the API, one editor at a time**: simpler, but discards the reason Yjs was required.

## Consequences

- Lesson content changes only through the document persistence module: live edits via the collaboration server, and seeding a generated document or restoring a version via the same module from the worker or API.
