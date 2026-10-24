import { sealPayload, sessionSecret } from '@lcg/session';

/** The collaboration server over HTTP (COLLAB_URL is its WebSocket address). */
const COLLAB_HTTP = (process.env.COLLAB_URL ?? 'ws://localhost:1234').replace(/^ws/, 'http');

/**
 * Asks the collaboration server to save a Lesson's open edits now (LCG-17), so a
 * Version frozen right after includes them. If the server cannot be reached it
 * holds no unsaved edits, and the caller goes ahead.
 */
export async function saveLessonNow(lessonId: string): Promise<void> {
  try {
    await fetch(`${COLLAB_HTTP}/flush/${lessonId}`, {
      method: 'POST',
      headers: { 'x-lcg-seal': sealPayload(`flush:${lessonId}`, sessionSecret()) },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Collaboration server unreachable: nothing unsaved to wait for.
  }
}
