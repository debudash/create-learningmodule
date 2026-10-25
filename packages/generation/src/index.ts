export { DEFAULT_GENERATION_GUIDANCE } from './guidance.js';
export { EXAMPLE_LESSON_TYPES, exampleMarkdown, exampleSources, type ExampleSource } from './examples.js';
export { addUsage, costOf, NO_USAGE, type TokenUsage } from './cost.js';
export {
  createFakeClient,
  createLiveClient,
  createReplayClient,
  NoRecordingError,
  type Effort,
  type LiveClientOptions,
  type LlmClient,
  type LlmRequest,
  type LlmResult,
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
  type ReviewFailure, type AiReview, type ModelCall, type ReviewInput, type ReviewResult } from './review.js';
export { placeholderEdit, suggestActivityEdit, type EditRequest, type EditResult } from './edit.js';
export { llmSettingsFromEnv, type LlmMode, type LlmSettings } from './settings.js';
