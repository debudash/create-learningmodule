import { connect } from '@lcg/db';
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

console.log(`worker running: ${concurrency} Lessons at a time, model mode ${process.env.LLM_MODE ?? 'replay'}`);

const stop = async () => {
  await queue.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
