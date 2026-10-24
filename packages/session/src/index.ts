import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Identity is supplied upstream (ADR 0010): sign-in picks a seeded user and this
 * module signs that choice so the web app and the collaboration server can both
 * trust it. Replacing sign-in with SSO replaces only this module.
 */

export const SESSION_COOKIE = 'lcg_session';

function signature(userId: string, secret: string): string {
  return createHmac('sha256', secret).update(userId).digest('base64url');
}

/** A token naming the user, safe to hand to the browser. */
export function signSession(userId: string, secret: string): string {
  return `${userId}.${signature(userId, secret)}`;
}

/** The user a token names, or undefined if it was not signed with this secret. */
export function verifySession(token: string | undefined, secret: string): string | undefined {
  if (!token) return undefined;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return undefined;
  const userId = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(signature(userId, secret));
  return given.length === expected.length && timingSafeEqual(given, expected) ? userId : undefined;
}

/** The session secret from the environment; refuses to run without one outside development. */
export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET is not set');
  return 'dev-only-session-secret';
}

/** A seal over data the server hands to the browser and expects back unchanged. */
export function sealPayload(payload: string, secret: string): string {
  return signature(payload, secret);
}

/** Whether data came back exactly as the server sealed it. */
export function isSealed(payload: string, seal: string | undefined, secret: string): boolean {
  if (!seal) return false;
  const given = Buffer.from(seal);
  const expected = Buffer.from(signature(payload, secret));
  return given.length === expected.length && timingSafeEqual(given, expected);
}
