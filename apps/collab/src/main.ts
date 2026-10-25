import { connect } from '@lcg/db';
import { sessionSecret } from '@lcg/session';
import { createCollabServer, followLessonChanges } from './server.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');
const { db } = connect(databaseUrl);
const port = Number(process.env.COLLAB_PORT ?? 1234);

const address = process.env.COLLAB_HOST;
const server = createCollabServer({ db, sessionSecret: sessionSecret(), port, ...(address ? { address } : {}) });
await followLessonChanges(server, databaseUrl);
await server.listen();
console.log(`collaboration server listening on ws://localhost:${port}`);
