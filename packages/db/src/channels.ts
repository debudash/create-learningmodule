import { sql } from 'drizzle-orm';
import pg from 'pg';
import type { Executor } from './client.js';

/**
 * Postgres LISTEN/NOTIFY channels that tell the collaboration server about Lesson
 * changes made elsewhere (worker, API). A notification sent inside a transaction is
 * delivered only if the transaction commits.
 */
export const LESSON_CHANNELS = {
  /** A Lesson's document was replaced as a whole (generation, Regenerate, Restore). */
  document: 'lesson_document',
  /** A Lesson's workflow status changed, which may change who can edit it. */
  status: 'lesson_status',
} as const;

export type LessonChannel = keyof typeof LESSON_CHANNELS;

export async function notifyLessonChange(db: Executor, channel: LessonChannel, lessonId: string): Promise<void> {
  await db.execute(sql`SELECT pg_notify(${LESSON_CHANNELS[channel]}, ${lessonId})`);
}

export interface LessonChangeListener {
  close(): Promise<void>;
}

/** Calls back with (channel, lessonId) for every Lesson change notification. */
export async function listenForLessonChanges(
  url: string,
  onChange: (channel: LessonChannel, lessonId: string) => void,
): Promise<LessonChangeListener> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const byName = new Map<string, LessonChannel>(
    Object.entries(LESSON_CHANNELS).map(([key, name]) => [name, key as LessonChannel]),
  );
  client.on('notification', ({ channel, payload }) => {
    const key = byName.get(channel);
    if (key && payload) onChange(key, payload);
  });
  for (const name of Object.values(LESSON_CHANNELS)) await client.query(`LISTEN ${name}`);
  return { close: () => client.end() };
}
