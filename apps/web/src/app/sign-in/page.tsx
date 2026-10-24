import { listUsers } from '@lcg/db';
import { db } from '@/server/db';
import { signIn } from './actions';

const ROLE_HINT = {
  editor: 'Imports Outlines, generates and edits Lessons, submits them for review.',
  approver: 'Everything an Editor does, plus approving, reopening and publishing.',
} as const;

export default async function SignInPage() {
  const users = await listUsers(db);
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-serif text-3xl font-semibold">Sign in</h1>
      <p className="mt-2 text-ink-soft">
        Choose who you are. In production this identity would come from Newsela single sign-on.
      </p>
      <ul className="mt-6 space-y-2">
        {users.map((user) => (
          <li key={user.id}>
            <form action={signIn}>
              <input type="hidden" name="userId" value={user.id} />
              <button className="flex w-full items-center justify-between rounded-lg border border-line bg-paper-raised px-4 py-3 text-left hover:border-accent">
                <span>
                  <span className="block font-medium">{user.name}</span>
                  <span className="block text-sm text-ink-soft">{ROLE_HINT[user.role]}</span>
                </span>
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium capitalize text-accent">
                  {user.role}
                </span>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
