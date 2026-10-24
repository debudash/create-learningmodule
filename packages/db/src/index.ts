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
  type AttemptRecord,
  type EnqueueGeneration,
  type GenerationJob,
  type GenerationContext,
  type StartGenerationResult,
} from './generation.js';
