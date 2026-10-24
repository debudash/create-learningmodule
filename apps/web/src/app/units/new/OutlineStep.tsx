'use client';

import type { OutlineSource } from '@lcg/db';
import type { ImportProposal } from '@lcg/outline';
import { useState, useTransition, type FormEvent } from 'react';
import { PrimaryButton } from '@/components/PrimaryButton';
import { readOutlineAction } from './actions';

/** Step 1: a Google Sheets link or an uploaded CSV/XLSX export of the Unit Outline. */
export function OutlineStep({
  onRead,
}: {
  onRead: (read: { proposal: ImportProposal; source: OutlineSource }) => void;
}) {
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await readOutlineAction(form);
      if (result.ok) onRead(result);
      else setMessage(result.message);
    });
  };

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
      <p className="text-ink-soft">
        Start from the Unit Outline the instructional designer wrote. Nothing is created until you
        confirm the import preview.
      </p>

      <label className="block">
        <span className="font-medium">Paste a Google Sheets link</span>
        <span className="block text-sm text-ink-soft">
          The sheet must be shared as “Anyone with the link can view”.
        </span>
        <input
          name="link"
          type="url"
          placeholder="https://docs.google.com/spreadsheets/d/…"
          className="mt-2 w-full rounded-lg border border-line bg-paper-raised px-3 py-2 focus:border-accent focus:outline-none"
        />
      </label>

      <div className="flex items-center gap-3 text-sm text-ink-faint">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <label className="block">
        <span className="font-medium">Upload a file</span>
        <span className="block text-sm text-ink-soft">
          A CSV or XLSX export of the Outline, for private sheets or other tools.
        </span>
        <input
          name="file"
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="mt-2 block text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-paper-raised file:px-3 file:py-1.5 file:text-ink"
        />
      </label>

      {message && (
        <p
          role="alert"
          className="rounded-lg border border-danger bg-danger-soft p-3 text-sm text-danger"
        >
          {message}
        </p>
      )}

      <PrimaryButton type="submit" disabled={pending}>
        {pending ? 'Reading the Outline…' : 'Read Outline'}
      </PrimaryButton>
    </form>
  );
}
