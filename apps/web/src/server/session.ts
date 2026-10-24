import { findUser, type User } from '@lcg/db';
import type { Actor } from '@lcg/domain';
import { SESSION_COOKIE, sessionSecret, signSession, verifySession } from '@lcg/session';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';

/** The signed-in user, if any (ADR 0010: identity is trusted, actions are still checked). */
export async function currentUser(): Promise<User | undefined> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const userId = verifySession(token, sessionSecret());
  return userId ? findUser(db, userId) : undefined;
}

/** The signed-in user; sends anyone else to sign in. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect('/sign-in');
  return user;
}

/** The token the browser presents to the collaboration server. */
export async function collaborationToken(): Promise<string> {
  const user = await requireUser();
  return signSession(user.id, sessionSecret());
}

export async function startSession(userId: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, signSession(userId, sessionSecret()), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The signed-in person as the workflow rules see them. */
export async function currentActor(): Promise<Extract<Actor, { kind: 'user' }>> {
  const user = await requireUser();
  return { kind: 'user', id: user.id, role: user.role };
}
