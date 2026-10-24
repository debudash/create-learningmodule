import type { Executor, GenerationJob } from '@lcg/db';
import { sql, type SQL } from 'drizzle-orm';
import PgBoss from 'pg-boss';

/**
 * The background job queue (ADR 0003): a small interface so the rest of the system
 * does not depend on pg-boss, which could later be swapped for BullMQ or SQS by
 * changing only this module.
 */

/** Run the AI Review of one Lesson. */
export interface ReviewLessonJob {
  lessonId: string;
}

export interface Jobs {
  'generate-lesson': GenerationJob;
  'review-lesson': ReviewLessonJob;
}

export type JobName = keyof Jobs;
const JOB_NAMES: JobName[] = ['generate-lesson', 'review-lesson'];

/** How many times a job is tried in all before it is given up. */
export const ATTEMPTS = 3;

export interface JobContext {
  /** True on the last attempt: a failure now is final. */
  finalAttempt: boolean;
}

export interface JobQueue {
  /** Adds a job inside the caller's transaction, so it exists only if the transaction commits. */
  enqueue<N extends JobName>(tx: Executor, name: N, job: Jobs[N]): Promise<void>;
  /** Runs `handler` for jobs of this kind, up to `concurrency` at a time. */
  work<N extends JobName>(
    name: N,
    concurrency: number,
    handler: (job: Jobs[N], context: JobContext) => Promise<void>,
  ): Promise<void>;
  stop(): Promise<void>;
}

export interface QueueOptions {
  /** Seconds before the first retry (doubled for each later one). */
  retryDelaySeconds?: number;
}

/** Opens the pg-boss queue in the application database. */
export async function openJobQueue(databaseUrl: string, { retryDelaySeconds = 5 }: QueueOptions = {}): Promise<JobQueue> {
  const boss = new PgBoss({ connectionString: databaseUrl });
  boss.on('error', (error) => console.error('[queue]', error));
  await boss.start();
  for (const name of JOB_NAMES) await boss.createQueue(name);

  return {
    async enqueue(tx, name, job) {
      await boss.send(name, job as object, {
        retryLimit: ATTEMPTS - 1,
        retryDelay: retryDelaySeconds,
        retryBackoff: true,
        db: { executeSql: (text, values) => runInTransaction(tx, text, values) },
      });
    },

    async work(name, concurrency, handler) {
      for (let i = 0; i < concurrency; i++) {
        await boss.work<Jobs[typeof name]>(
          name,
          { batchSize: 1, includeMetadata: true, pollingIntervalSeconds: 1 },
          async ([job]) => {
            if (!job) return;
            await handler(job.data, { finalAttempt: job.retryCount >= job.retryLimit });
          },
        );
      }
    },

    stop: () => boss.stop({ graceful: true, wait: true }),
  };
}

/** Runs pg-boss's parameterised SQL ($1, $2, ...) on a Drizzle transaction. */
async function runInTransaction(tx: Executor, text: string, values: unknown[]): Promise<{ rows: unknown[] }> {
  const parts = text.split(/\$(\d+)/);
  const chunks: SQL[] = [];
  parts.forEach((part, i) => {
    chunks.push(i % 2 === 0 ? sql.raw(part) : sql`${sql.param(values[Number(part) - 1])}`);
  });
  const result = await tx.execute(sql.join(chunks, sql.raw('')));
  return { rows: result.rows };
}
