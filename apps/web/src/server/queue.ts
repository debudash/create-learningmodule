import { openJobQueue, type JobQueue } from '@lcg/queue';

// One queue connection per server process, surviving Next.js hot reloads in development.
const holder = globalThis as unknown as { lcgQueue?: Promise<JobQueue> };

/** The job queue, used here only to send jobs (the worker runs them). */
export function jobQueue(): Promise<JobQueue> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  holder.lcgQueue ??= openJobQueue(url);
  return holder.lcgQueue;
}
