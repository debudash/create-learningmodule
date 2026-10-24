import type { LessonStatus } from '@lcg/domain';
import { eq, sql } from 'drizzle-orm';
import type { Executor } from './client.js';
import { lessons, users } from './schema.js';

export interface User {
  id: string;
  name: string;
  role: 'editor' | 'approver';
}

export async function findUser(db: Executor, userId: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user;
}

export async function findLessonStatus(db: Executor, lessonId: string): Promise<LessonStatus | undefined> {
  const [row] = await db.select({ status: lessons.status }).from(lessons).where(eq(lessons.id, lessonId));
  return row?.status;
}

/** Remembers who has edited a Lesson since it was last generated (for Self-Approval). */
export async function recordEditors(db: Executor, lessonId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const added = `{${userIds.join(',')}}`;
  await db
    .update(lessons)
    .set({
      editorIds: sql`(SELECT array_agg(DISTINCT e) FROM unnest(${lessons.editorIds} || ${added}::uuid[]) AS e)`,
    })
    .where(eq(lessons.id, lessonId));
}
