import { LESSON_STATUS_LABELS, type LessonStatus } from './vocabulary.js';

export type Publishability =
  | { ok: true }
  | { ok: false; waiting: Partial<Record<LessonStatus, string[]>>; message: string };

/**
 * Whether a Unit can be Published (GLOSSARY: Published): only when every one of
 * its Lessons is Approved. Otherwise, which Lessons are holding it back.
 */
export function publishability(lessons: readonly { key: string; status: LessonStatus }[]): Publishability {
  if (lessons.length === 0) return { ok: false, waiting: {}, message: 'This Unit has no Lessons.' };
  const waiting: Partial<Record<LessonStatus, string[]>> = {};
  for (const lesson of lessons) {
    if (lesson.status === 'approved') continue;
    (waiting[lesson.status] ??= []).push(lesson.key);
  }
  const groups = Object.entries(waiting) as [LessonStatus, string[]][];
  if (groups.length === 0) return { ok: true };
  const count = groups.reduce((n, [, keys]) => n + keys.length, 0);
  const detail = groups.map(([status, keys]) => `${LESSON_STATUS_LABELS[status]} ${keys.join(', ')}`).join('; ');
  return {
    ok: false,
    waiting,
    message: `${count} Lesson${count === 1 ? ' is' : 's are'} not Approved yet: ${detail}.`,
  };
}
