/**
 * Load test for "a staff of 20+ reviewers" (brief, performance benchmarks), run
 * against the stack in Docker Compose:
 *
 *   cd apps/collab && npx tsx --env-file=../../.env scripts/load-test.ts
 *
 * REVIEWERS people (default 25) work for DURATION_S seconds (default 60), five to
 * a Lesson: each edits its Lesson every 2 s over the collaboration server, and
 * loads the Unit board and its Lesson page every 5 s. Reports how long an edit
 * takes to reach the others in the same Lesson, page response times, and errors.
 * It edits Lesson titles, so reset the database afterwards (pnpm db:reset).
 */
import { HocuspocusProvider } from '@hocuspocus/provider';
import { connect, schema } from '@lcg/db';
import { LESSON_FRAGMENT } from '@lcg/lesson-schema';
import { SESSION_COOKIE, sessionSecret, signSession } from '@lcg/session';
import * as Y from 'yjs';
import { documentNameFor } from '../src/server.js';

const REVIEWERS = Number(process.env.REVIEWERS ?? 25);
const DURATION_MS = Number(process.env.DURATION_S ?? 60) * 1000;
const PER_LESSON = 5;
const COLLAB_URL = process.env.LOAD_COLLAB_URL ?? 'ws://localhost:1234';
const WEB_URL = process.env.LOAD_WEB_URL ?? 'http://localhost:3000';

const { db, close } = connect();
const users = await db.select({ id: schema.users.id }).from(schema.users);
const lessonCount = Math.ceil(REVIEWERS / PER_LESSON);
const lessons = (
  await db
    .select({ id: schema.lessons.id, unitId: schema.lessons.unitId, status: schema.lessons.status, position: schema.lessons.position })
    .from(schema.lessons)
)
  .filter((l) => ['draft', 'in-review', 'changes-requested'].includes(l.status))
  .sort((a, b) => a.position - b.position)
  .slice(0, lessonCount);
if (lessons.length < lessonCount) throw new Error(`Need ${lessonCount} editable Lessons; generate the Unit first.`);

const syncMs: number[] = [];
const pageMs: Record<string, number[]> = { board: [], lesson: [] };
let errors = 0;

const titleOf = (document: Y.Doc) => document.getXmlFragment(LESSON_FRAGMENT).get(0) as Y.XmlElement;

/** One reviewer: a live connection to their Lesson, editing and loading pages until the end. */
async function reviewer(index: number, until: number): Promise<void> {
  const lesson = lessons[Math.floor(index / PER_LESSON)]!;
  const token = signSession(users[index % users.length]!.id, sessionSecret());
  const document = new Y.Doc();
  const provider = new HocuspocusProvider({ url: COLLAB_URL, name: documentNameFor(lesson.id), token, document });
  await new Promise<void>((resolve, reject) => {
    provider.on('synced', () => resolve());
    provider.on('authenticationFailed', () => reject(new Error('authentication failed')));
  });

  // Every edit carries the time it was made; seeing another reviewer's edit measures its trip.
  titleOf(document).observe(() => {
    const [, who, at] = String(titleOf(document).getAttribute('title')).split('|');
    if (who && Number(who) !== index) syncMs.push(Date.now() - Number(at));
  });

  const page = async (kind: 'board' | 'lesson', path: string) => {
    const started = Date.now();
    try {
      const response = await fetch(`${WEB_URL}${path}`, { headers: { cookie: `${SESSION_COOKIE}=${token}` } });
      await response.text();
      if (!response.ok) errors++;
      pageMs[kind]!.push(Date.now() - started);
    } catch {
      errors++;
    }
  };

  let tick = 0;
  while (Date.now() < until) {
    titleOf(document).setAttribute('title', `Load test|${index}|${Date.now()}`);
    if (tick % 3 === index % 3) {
      await Promise.all([page('board', `/units/${lesson.unitId}`), page('lesson', `/lessons/${lesson.id}`)]);
    }
    tick++;
    await new Promise((r) => setTimeout(r, 2000));
  }
  provider.destroy();
}

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]! : NaN;
};
const summary = (values: number[]) =>
  `${values.length} samples, p50 ${percentile(values, 50)} ms, p95 ${percentile(values, 95)} ms, max ${Math.max(...values)} ms`;

const until = Date.now() + DURATION_MS;
const results = await Promise.allSettled(Array.from({ length: REVIEWERS }, (_, i) => reviewer(i, until)));
const failed = results.filter((r) => r.status === 'rejected').length;

console.log(`${REVIEWERS} reviewers on ${lessons.length} Lessons for ${DURATION_MS / 1000} s (${failed} could not connect)`);
console.log(`Edit reaches the others: ${summary(syncMs)}`);
console.log(`Unit board page:         ${summary(pageMs.board!)}`);
console.log(`Lesson page:             ${summary(pageMs.lesson!)}`);
console.log(`Errors: ${errors}`);
await close();
process.exit(0);
