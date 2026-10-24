import { connect } from '@lcg/db';
import { sessionSecret } from '@lcg/session';
import { createCollabServer } from './server.js';

const { db } = connect();
const port = Number(process.env.COLLAB_PORT ?? 1234);

await createCollabServer({ db, sessionSecret: sessionSecret(), port }).listen();
console.log(`collaboration server listening on ws://localhost:${port}`);
