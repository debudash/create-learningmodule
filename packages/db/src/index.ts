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
  listUnits,
  listUsers,
  unitBoard,
  workspaceLesson,
  type BoardLesson,
  type UnitBoard,
  type UnitSummary,
  type WorkspaceLesson,
} from './queries.js';
