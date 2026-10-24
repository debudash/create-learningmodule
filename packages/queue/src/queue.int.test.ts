import { freshDatabase, type TestDatabase } from '@lcg/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ATTEMPTS, openJobQueue, type JobQueue } from './index.js';

let database: TestDatabase;
let queue: JobQueue;

beforeAll(async () => {
  database = await freshDatabase();
  queue = await openJobQueue(database.url, { retryDelaySeconds: 1 });
});
afterAll(async () => {
  await queue.stop();
  await database.close();
});

async function eventually(check: () => boolean, timeoutMs = 20_000): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('condition not met in time');
}

describe('job queue', () => {
  it('runs a job only if the transaction that enqueued it commits', async () => {
    const seen: string[] = [];
    await queue.work('review-lesson', 1, async (job) => {
      seen.push(job.lessonId);
    });

    await database.db
      .transaction(async (tx) => {
        await queue.enqueue(tx, 'review-lesson', { lessonId: 'rolled-back' });
        throw new Error('roll back');
      })
      .catch(() => undefined);
    await database.db.transaction((tx) => queue.enqueue(tx, 'review-lesson', { lessonId: 'committed' }));

    await eventually(() => seen.includes('committed'));
    await new Promise((r) => setTimeout(r, 1500));
    expect(seen).toEqual(['committed']);
  });

  it('retries a failing job and says which attempt is the last', async () => {
    const attempts: boolean[] = [];
    await queue.work('generate-lesson', 1, async (_job, { finalAttempt }) => {
      attempts.push(finalAttempt);
      throw new Error('model unavailable');
    });
    await database.db.transaction((tx) => queue.enqueue(tx, 'generate-lesson', { lessonId: 'flaky' }));

    await eventually(() => attempts.length === ATTEMPTS, 30_000);
    expect(attempts).toEqual([false, false, true]);
  }, 40_000);
});
