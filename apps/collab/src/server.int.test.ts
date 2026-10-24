import { createServer } from 'node:net';
import { HocuspocusProvider } from '@hocuspocus/provider';
import {
  notifyLessonChange,
  readLessonContent,
  replaceLessonContent,
  workspaceLesson,
  type LessonChangeListener,
} from '@lcg/db';
import {
  freshDatabase,
  importSampleUnit,
  lessonEditors,
  setLessonStatus,
  setLessonStatusById,
  type TestDatabase,
} from '@lcg/db/testing';
import { LESSON_FRAGMENT } from '@lcg/lesson-schema';
import { sampleLesson } from '@lcg/lesson-schema/testing';
import { sealPayload, signSession } from '@lcg/session';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createCollabServer, documentNameFor, followLessonChanges } from './server.js';

const SECRET = 'test-secret';
let database: TestDatabase;
let server: ReturnType<typeof createCollabServer>;
let url: string;
let httpUrl: string;
let listener: LessonChangeListener;
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
    await replaceLessonContent(database.db, lessonIds[key]!, sampleLesson());
  }
  const port = await freePort();
  url = `ws://127.0.0.1:${port}`;
  httpUrl = `http://127.0.0.1:${port}`;
  // A realistic save delay, so tests show whether something waits for the debounced store.
  server = createCollabServer({ db: database.db, sessionSecret: SECRET, port, debounce: 1000 });
  listener = await followLessonChanges(server, database.url);
  await server.listen();
});

afterAll(async () => {
  await listener.close();
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

async function eventually(check: () => Promise<boolean>, timeoutMs = 8000): Promise<void> {
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

  // LCG-8 regression. Found by: Phase 2 spec review (read-only was decided only when a connection opened).
  it('LCG-8: makes open editors read-only when a Lesson is Approved, and editable again after Reopen', async () => {
    const lessonId = lessonIds.L3!;
    const { document, provider, synced } = open(lessonId, signSession(database.editorId, SECRET));
    await synced;
    const changeStatus = async (status: 'approved' | 'in-review') => {
      await setLessonStatusById(database.db, lessonId, status);
      await notifyLessonChange(database.db, 'status', lessonId);
    };

    await changeStatus('approved');
    await eventually(async () => provider.authorizedScope === 'readonly');
    const approved = await readLessonContent(database.db, lessonId);
    retitle(document, 'Edited after approval');
    await new Promise((r) => setTimeout(r, 2000));
    expect(await readLessonContent(database.db, lessonId)).toEqual(approved);

    await changeStatus('in-review');
    await eventually(async () => provider.authorizedScope === 'read-write');
    retitle(document, 'Edited after Reopen');
    await eventually(async () => (await readLessonContent(database.db, lessonId))?.title === 'Edited after Reopen');
    provider.destroy();
  });

  // LCG-7 regression. Found by: Phase 2 spec review (whole-Lesson writes bypassed the live document).
  it('LCG-7: delivers a whole-Lesson replacement to open editors without losing or duplicating it', async () => {
    const { document, provider, synced } = open(lessonIds.L3!, signSession(database.editorId, SECRET));
    await synced;
    const header = () => document.getXmlFragment(LESSON_FRAGMENT).get(0) as Y.XmlElement;

    await replaceLessonContent(database.db, lessonIds.L3!, { ...sampleLesson(), title: 'Regenerated' });
    await eventually(async () => header().getAttribute('title') === 'Regenerated');
    expect(document.getXmlFragment(LESSON_FRAGMENT).length).toBe(sampleLesson().sections.length + 1);

    // The editor keeps working on the replaced content, and the server's next save keeps both.
    retitle(document, 'Regenerated, then edited');
    await eventually(
      async () => (await readLessonContent(database.db, lessonIds.L3!))?.title === 'Regenerated, then edited',
    );
    expect((await readLessonContent(database.db, lessonIds.L3!))?.sections).toEqual(sampleLesson().sections);
    provider.destroy();
  });

  // LCG-6 regression. Found by: Phase 2 spec review (the board kept the old title after an edit).
  it('LCG-6: keeps the Lesson title shown on the board in step with the document', async () => {
    const { document, provider, synced } = open(lessonIds.L3!, signSession(database.editorId, SECRET));
    await synced;
    retitle(document, 'Renamed in the editor');
    await eventually(async () => (await workspaceLesson(database.db, lessonIds.L3!))?.title === 'Renamed in the editor');
    provider.destroy();
  });

  // LCG-5 regression. Found by: Phase 2 spec review (the server stored any document a client sent).
  it('LCG-5: does not store a document that is no longer a valid Lesson', async () => {
    const { document, provider, synced } = open(lessonIds.L3!, signSession(database.editorId, SECRET));
    await synced;
    const before = await readLessonContent(database.db, lessonIds.L3!);
    // A crafted client bypasses the editor's structure guard and deletes the Launch Section.
    document.getXmlFragment(LESSON_FRAGMENT).delete(1, 1);
    await new Promise((r) => setTimeout(r, 2000));
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
    await new Promise((r) => setTimeout(r, 2000));
    expect((await readLessonContent(database.db, lessonIds.L4!))?.title).toBe(sampleLesson().title);
    provider.destroy();
  });

  // LCG-17 regression. Found by: Phase 4 spec review (an approval could freeze content saved before the last edits).
  it('LCG-17: saves open edits at once when asked, and refuses an unsealed request', async () => {
    const { document, provider, synced } = open(lessonIds.L3!, signSession(database.editorId, SECRET));
    await synced;
    retitle(document, 'Edited just before approval');
    await new Promise((r) => setTimeout(r, 100));

    const refused = await fetch(`${httpUrl}/flush/${lessonIds.L3}`, { method: 'POST' });
    expect(refused.status).toBe(403);
    const flushed = await fetch(`${httpUrl}/flush/${lessonIds.L3}`, {
      method: 'POST',
      headers: { 'x-lcg-seal': sealPayload(`flush:${lessonIds.L3}`, SECRET) },
    });
    expect(flushed.status).toBe(204);
    expect((await readLessonContent(database.db, lessonIds.L3!))?.title).toBe('Edited just before approval');
    provider.destroy();
  });
});
