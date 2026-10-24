'use server';

import { findUser } from '@lcg/db';
import { redirect } from 'next/navigation';
import { db } from '@/server/db';
import { endSession, startSession } from '@/server/session';

export async function signIn(formData: FormData): Promise<void> {
  const user = await findUser(db, String(formData.get('userId') ?? ''));
  if (!user) redirect('/sign-in');
  await startSession(user.id);
  redirect('/units');
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect('/sign-in');
}
