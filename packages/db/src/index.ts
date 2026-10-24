export { connect, type Connection, type Database, type Executor } from './client.js';
export * as schema from './schema.js';
export type { LessonDigest, OutlineSource } from './schema.js';
export { importUnit, type ImportUnitInput } from './units.js';
export {
  loadDocumentState,
  readLessonContent,
  replaceLessonContent,
  saveLiveDocument,
  type SaveOutcome,
} from './documents.js';
export {
  LESSON_CHANNELS,
  listenForLessonChanges,
  notifyLessonChange,
  type LessonChangeListener,
  type LessonChannel,
} from './channels.js';
export { findLessonStatus, findUser, recordEditors, type User } from './lessons.js';
export {
  guidanceHistory,
  listUnits,
  listUsers,
  saveGuidance,
  type GuidanceVersion,
  unitBoard,
  workspaceLesson,
  type BoardLesson,
  type UnitBoard,
  type UnitSummary,
  type WorkspaceLesson,
} from './queries.js';
export { transitionLesson, type TransitionRequest, type TransitionResult } from './workflow.js';
export {
  beginGenerating,
  cancelGeneration,
  captureVersion,
  completeGeneration,
  enqueueReadyLessons,
  failStalledGenerations,
  loadGenerationContext,
  promptInputFor,
  recordGenerationFailure,
  regenerateLesson,
  startGeneration,
  liveGenerationsToday,
  type GenerationAttemptInput,
  type EnqueueGeneration,
  type GenerationJob,
  type GenerationContext,
  type StartGenerationResult,
} from './generation.js';
export {
  applyReviewAction,
  approveLessons,
  assignLesson,
  lessonHistory,
  listReleases,
  publishSummary,
  publishUnit,
  readVersion,
  releaseExport,
  restoreVersion,
  type BulkResult,
  type LessonHistory,
  type PublishResult,
  type PublishSummary,
  type ReleaseExport,
  type ReleaseSummary,
  type RestoreResult,
} from './review.js';
export {
  checkCounts,
  currentFailingChecks,
  latestAiReview,
  type LastAiReview,
  checkFactsOf,
  lessonChecks,
  loadReviewContext,
  replaceCheckResults,
  saveAiReview,
  type ReviewContext,
} from './checks.js';
