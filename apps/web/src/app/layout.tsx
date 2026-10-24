import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { currentUser } from '@/server/session';
import { signOut } from './sign-in/actions';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lesson Studio',
  description: 'Generate, review and approve Core curriculum Lessons.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <header className="border-b border-line bg-paper-raised">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <Link href="/units" className="font-serif text-lg font-semibold text-ink">
              Lesson Studio
            </Link>
            {user && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-ink">{user.name}</span>
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium capitalize text-accent">
                  {user.role}
                </span>
                <form action={signOut}>
                  <button className="text-ink-soft underline-offset-2 hover:underline">Switch user</button>
                </form>
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
