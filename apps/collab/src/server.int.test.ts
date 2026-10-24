import { createServer } from 'node:net';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { readLessonContent, writeLessonContent } from '@lcg/db';
import {
  freshDatabase,
  importSampleUnit,
  lessonEditors,
  setLessonStatus,
  type TestDatabase,
} from '@lcg/db/testing';
import { LESSON_FRAGMENT } from '@lcg/lesson-schema';
import { sampleLesson } from '@lcg/lesson-schema/testing';
import { signSession } from '@lcg/session';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createCollabServer, documentNameFor } from './server.js';

const SECRET = 'test-secret';
let database: TestDatabase;
let server: ReturnType<typeof createCollabServer>;
let url: string;
const lessonIds: Record<string, string> = {};

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const probe = createServer().listen(0, () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

beforeAll(async () => {
  database = await freshDatabase();
  const unitId = await importSampleUnit(database.db, database.editorId);
  for (const [key, status] of [
    ['L3', 'draft'],
    ['L4', 'approved'],
  ] as const) {
    lessonIds[key] = await setLessonStatus(database.db, unitId, key, status);
    await writeLessonContent(database.db, lessonIds[key]!, sampleLesson());
  }
  const port = await freePort();
  url = `ws://127.0.0.1:${port}`;
  server = createCollabServer({ db: database.db, sessionSecret: SECRET, port, debounce: 20 });
  await server.listen();
});

afterAll(async () => {
  await server.destroy();
  await database.close();
});

function open(lessonId: string, token: string) {
  const document = new Y.Doc();
  const provider = new HocuspocusProvider({
    url,
    name: documentNameFor(lessonId),
    token,
    document,
  });
  const synced = new Promise<void>((resolve, reject) => {
    provider.on('synced', () => resolve());
    provider.on('authenticationFailed', ({ reason }: { reason: string }) => reject(new Error(reason)));
  });
  return { document, provider, synced };
}

const retitle = (document: Y.Doc, title: string) =>
  (document.getXmlFragment(LESSON_FRAGMENT).get(0) as Y.XmlElement).setAttribute('title', title);

async function eventually(check: () => Promise<boolean>, timeoutMs = 3000): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('condition not met in time');
}

describe('collaboration server', () => {
  it('serves the stored Lesson and saves an Editor change, recording the Editor', async () => {
    const { document, provider, synced } = open(lessonIds.L3!, signSession(database.editorId, SECRET));
    await synced;
    expect((document.getXmlFragment(LESSON_FRAGMENT).get(0) as Y.XmlElement).getAttribute('title')).toBe(
      sampleLesson().title,
    );

    retitle(document, 'Edited live');
    await eventually(async () => (await readLessonContent(database.db, lessonIds.L3!))?.title === 'Edited live');
    expect(await lessonEditors(database.db, lessonIds.L3!)).toEqual([database.editorId]);
    provider.destroy();
  });

  it('syncs one Editor change to another connected Editor', async () => {
    const a = open(lessonIds.L3!, signSession(database.editorId, SECRET));
    const b = open(lessonIds.L3!, signSession(database.approverId, SECRET));
    await Promise.all([a.synced, b.synced]);
    retitle(a.document, 'Seen by both');
    const header = () => b.document.getXmlFragment(LESSON_FRAGMENT).get(0) as Y.XmlElement;
    await eventually(async () => header().getAttribute('title') === 'Seen by both');
    a.provider.destroy();
    b.provider.destroy();
  });

  // LCG-5 regression. Found by: Phase 2 spec review (the server stored any document a client sent).
  it('LCG-5: does not store a document that is no longer a valid Lesson', async () => {
    const { document, provider, synced } = open(lessonIds.L3!, signSession(database.editorId, SECRET));
    await synced;
    const before = await readLessonContent(database.db, lessonIds.L3!);
    // A crafted client bypasses the editor's structure guard and deletes the Launch Section.
    document.getXmlFragment(LESSON_FRAGMENT).delete(1, 1);
    await new Promise((r) => setTimeout(r, 300));
    expect(await readLessonContent(database.db, lessonIds.L3!)).toEqual(before);
    provider.destroy();
  });

  it('refuses a connection without a valid session', async () => {
    const { provider, synced } = open(lessonIds.L3!, 'forged.token');
    await expect(synced).rejects.toThrow();
    provider.destroy();
  });

  it('opens an Approved Lesson read-only and never stores changes to it', async () => {
    const { document, provider, synced } = open(lessonIds.L4!, signSession(database.editorId, SECRET));
    await synced;
    retitle(document, 'Should not stick');
    await new Promise((r) => setTimeout(r, 300));
    expect((await readLessonContent(database.db, lessonIds.L4!))?.title).toBe(sampleLesson().title);
    provider.destroy();
  });
});
