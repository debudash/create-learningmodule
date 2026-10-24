'use client';

import { useState, useTransition } from 'react';
import type { ActionResult } from '@/server/action-result';
import { publishUnitAction } from './actions';

export function PublishButton({ unitId, disabled }: { unitId: string; disabled: boolean }) {
  const [message, setMessage] = useState<ActionResult>();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => startTransition(async () => setMessage(await publishUnitAction(unitId)))}
        className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        Publish Unit
      </button>
      {message && (
        <span role="status" className={message.ok ? 'text-support' : 'text-danger'}>
          {message.message}
        </span>
      )}
    </div>
  );
}
