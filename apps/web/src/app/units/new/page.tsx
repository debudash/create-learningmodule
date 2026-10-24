import { DEFAULT_GENERATION_GUIDANCE } from '@lcg/generation';
import Link from 'next/link';
import { requireUser } from '@/server/session';
import { NewUnitWizard } from './NewUnitWizard';

export default async function NewUnitPage() {
  await requireUser();
  return (
    <div>
      <div className="text-sm text-ink-soft">
        <Link href="/units" className="hover:underline">
          Units
        </Link>{' '}
        / New Unit
      </div>
      <h1 className="mt-1 font-serif text-3xl font-semibold">New Unit</h1>
      <NewUnitWizard defaultGuidance={DEFAULT_GENERATION_GUIDANCE} />
    </div>
  );
}
