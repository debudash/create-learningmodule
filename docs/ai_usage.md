# AI usage

Two kinds of AI use in this project: AI inside the product, and AI used to build it. The detailed, per-action record of the second is [AI_LOG.md](AI_LOG.md).

## 1. AI inside the product

| Feature | Model | Input | Output | Human control |
|---|---|---|---|---|
| Lesson generation | Claude Sonnet | Outline row and neighbours, Arc and Unit context, official standards text, one Units 1–3 example Lesson, Generation Guidance | Lesson JSON (validated, repaired once if invalid) | Editors write the Guidance, preview the prompt, run trial batches, Regenerate with instructions; every Lesson is reviewed before approval |
| Lesson Digest | Same call | The generated Lesson | Short summary for Flex Days | None needed (internal) |
| Outline description check | Claude (small call at import) | An ELD code's official text and the Outline's description | Match / mismatch with suggested code | The Editor resolves every warning |
| AI Review | Claude | The Lesson and its Focus Standards' official text | Per-standard verdict with reason; anchor-text usage | Informs; never blocks approval |
| AI editing | Claude Sonnet | Selected blocks and Lesson context | Replacement blocks as an AI Suggestion | Accepted or rejected by the requesting Editor; recorded in history |

Safeguards:
- Standards text never comes from the model ([ADR 0006](adr/0006-checked-in-standards-dataset.md)).
- The Answer Key never enters a prompt ([ADR 0007](adr/0007-unit-4-held-out-as-answer-key.md)).
- Outline cell text is passed as data inside clearly delimited sections, not as instructions to the system.
- Every call is recorded with model, tokens, cost and outcome.
- Cost control: prompt caching of the shared prefix, trial batches, replay and fake modes, a daily cap on the hosted demo.

## 2. AI used to build the product

Tools: Claude Code (Opus) as the lead agent, with sub-agents for research, independent slices, review (`/code-review`) and adversarial testing, as described in [agents.md](agents.md).

What the owner decided (through a structured design interview, recorded in [decisions.md](decisions.md)): purpose and audience, hosting, stack, database, collaboration depth, queue, model and tracing, identity, vocabulary and workflow, scope of generation, standards source, lesson storage, evaluation approach, screens, versioning, publish output, demo data, testing and documentation.

What AI did:
- Researched the reference material: downloaded the sample Outline, all 180 published Lessons and the official standards sources, and summarised their structure.
- Proposed options and recommendations for each decision, which the owner accepted, changed or rejected (for example: BullMQ considered and rejected; LangSmith made optional; CI removed; deployment gated on local sign-off).
- Wrote the glossary, ADRs, PRD and these documents.
- Writes and reviews the code phase by phase.

Where AI output was corrected or overridden is noted in [AI_LOG.md](AI_LOG.md).
