# Call the Anthropic SDK directly, with no agent framework; LangSmith only when switched on by environment

Generation, AI Review and AI editing each use the Anthropic TypeScript SDK (Claude Sonnet) directly: one structured, schema-validated call plus at most one repair call. None of these tasks needs an agent choosing tools, so LangChain would add ceremony without capability. Observability is a Generation Attempt record per call (tokens, cost, duration, raw output); LangSmith tracing wraps the client only when `LANGSMITH_TRACING=true` and an API key are set, so it costs nothing by default.

## Consequences

- The LLM client has three modes (live, replay, fake) selected by environment; tests and the demo never need an API key.
- Amended in Phase 5: the AI Review is a judging task, so it runs on a cheaper model (`LLM_REVIEW_MODEL`, Claude Haiku by default) rather than Sonnet. Each review call is kept with its tokens and cost, like a Generation Attempt, and counts in the Unit's cost. Replay mode serves a review only for content it has a recording of; otherwise the review is recorded as unavailable.
