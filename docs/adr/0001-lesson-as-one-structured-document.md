# A Lesson is one structured ProseMirror document; the student view is derived

Each Lesson is stored as a single Yjs-backed ProseMirror document with a strict custom schema: the lesson header and each section (Launch, Literacy Lab, Learning in Action, Look Back, Homework) are fixed-order nodes, and activities, teacher scripts, sample responses, Pulse Checks, ELD supports and differentiation tables are typed blocks, with teacher-only blocks marked. Generation emits lesson JSON that is converted into the initial document; quality checks and export serialise the document back to JSON. We chose this so that standards alignment and pacing can be checked structurally while people co-edit, and so header edits share the same live-editing session as the body.

## Considered Options

- **Header as form fields + sections as free rich text**: simpler editor, but standards and timing tags become unverifiable prose, and the header falls outside live co-editing.
- **Separate teacher and student copies** (as Newsela's published lessons store them): faithful to the source, but two hand-maintained copies drift; the student view is instead derived by stripping teacher-only blocks.

## Consequences

- The ProseMirror schema is the lesson contract; changing it needs a document migration.
- Generation output must validate against a JSON schema that maps one-to-one onto the ProseMirror schema.
