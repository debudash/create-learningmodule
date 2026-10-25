export { DEFAULT_GENERATION_GUIDANCE } from './guidance.js';
export { EXAMPLE_LESSON_TYPES, exampleMarkdown, exampleSources, type ExampleSource } from './examples.js';
export { addUsage, costOf, NO_USAGE, type TokenUsage } from './cost.js';
export {
  createFakeClient,
  createLiveClient,
  callModel,
  createReplayClient,
  NoRecordingError,
  type Effort,
  type LiveClientOptions,
  type LlmClient,
  type LlmRequest,
  type LlmResult,
  type ModelCall,
} from './llm.js';
export {
  generationOutputJsonSchema,
  generationOutputSchema,
  lessonDigestSchema,
  type GenerationOutput,
  type LessonDigest,
} from './output.js';
export {
  buildLessonPrompt,
  LOCKED_INSTRUCTIONS,
  PROMPT_VERSION,
  type LessonPrompt,
  type LessonPromptInput,
  type PromptArc,
  type PromptUnit,
} from './prompt.js';
export {
  generateLesson,
  type GenerationOutcome,
  type GenerationAttemptRecord,
  type GenerationResult,
} from './generate.js';
export { placeholderOutput } from './placeholder.js';
export {
  aiReviewSchema,
  reviewKey,
  reviewLesson,
  toCheckResults,
  type AiReview,
  type ReviewFailure,
  type ReviewInput,
  type ReviewResult,
} from './review.js';
export { placeholderSuggestion, suggestActivityChange, suggestionKey, type SuggestionRequest, type SuggestionResult } from './suggestion.js';
export {
  clientFromSettings,
  DEFAULT_MODEL,
  DEFAULT_REVIEW_MODEL,
  llmSettingsFromEnv,
  type LlmMode,
  type LlmSettings,
} from './settings.js';
