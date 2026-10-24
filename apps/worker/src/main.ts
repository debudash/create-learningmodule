import { connect, failStalledGenerations } from '@lcg/db';
import { exampleMarkdown } from '@lcg/generation';
import { openJobQueue } from '@lcg/queue';
import { handleGenerateJob } from './generate-job.js';
import { modelsFromEnv } from './models.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const { db } = connect(databaseUrl);
const queue = await openJobQueue(databaseUrl);
const clientFor = await modelsFromEnv();
const concurrency = Number(process.env.GENERATION_CONCURRENCY ?? 5);

await queue.work('generate-lesson', concurrency, (job, context) =>
  handleGenerateJob(
    {
      db,
      enqueue: (tx, next) => queue.enqueue(tx, 'generate-lesson', next),
      clientFor,
      exampleFor: exampleMarkdown,
    },
    job,
    context,
  ),
);

// A generation never takes this long; a Lesson still Generating was lost with a stopped worker (LCG-11).
const STALLED_AFTER_MINUTES = 30;
const sweep = setInterval(() => {
  failStalledGenerations(db, { olderThanMinutes: STALLED_AFTER_MINUTES }).catch((error) =>
    console.error('[sweep]', error),
  );
}, 60_000);

console.log(`worker running: ${concurrency} Lessons at a time, model mode ${process.env.LLM_MODE ?? 'replay'}`);

const stop = async () => {
  clearInterval(sweep);
  await queue.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
