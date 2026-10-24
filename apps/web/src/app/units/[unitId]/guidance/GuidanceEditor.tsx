'use client';

import { useState, useTransition } from 'react';
import { saveGuidanceAction } from './actions';

export function GuidanceEditor({ unitId, initialText }: { unitId: string; initialText: string }) {
  const [text, setText] = useState(initialText);
  const [saved, setSaved] = useState(initialText);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={16}
        className="w-full rounded-lg border border-line bg-paper-raised p-3 leading-relaxed focus:border-accent focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          disabled={pending || text.trim() === '' || text === saved}
          onClick={() =>
            startTransition(async () => {
              const result = await saveGuidanceAction(unitId, text);
              setMessage(result.message ?? 'Saved.');
              if (result.ok) setSaved(text);
            })
          }
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Save as new version
        </button>
        {message && (
          <span role="status" className="text-sm text-ink-soft">
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
