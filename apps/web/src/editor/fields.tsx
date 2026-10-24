'use client';

import { useState, type ReactNode } from 'react';

/** Small form controls used inside editor node views. */

export function Label({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">{children}</span>;
}

interface TextProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function TextInput({ value, onChange, disabled, placeholder, className = '' }: TextProps) {
  return (
    <input
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-md border border-transparent bg-transparent px-2 py-1 hover:border-line focus:border-accent focus:bg-paper-raised focus:outline-none disabled:hover:border-transparent ${className}`}
    />
  );
}

export function TextArea({ value, onChange, disabled, placeholder, className = '' }: TextProps) {
  return (
    <textarea
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      rows={Math.max(2, Math.ceil(value.length / 90))}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full resize-y rounded-md border border-line bg-paper-raised px-2 py-1.5 leading-relaxed focus:border-accent focus:outline-none disabled:border-transparent disabled:bg-transparent ${className}`}
    />
  );
}

/** Standard codes edited as a comma-separated list, shown as chips when read-only. */
export function CodesInput({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.length === 0 && <span className="text-sm text-ink-faint">None</span>}
        {value.map((code) => (
          <span key={code} className="rounded bg-accent-soft px-1.5 py-0.5 font-mono text-xs text-accent">
            {code}
          </span>
        ))}
      </div>
    );
  }
  return <CodesEditor value={value} onChange={onChange} />;
}

function CodesEditor({ value, onChange }: { value: string[]; onChange: (codes: string[]) => void }) {
  const joined = value.join(', ');
  const [draft, setDraft] = useState<string | undefined>();
  // While focused the text is local, so typing "RL.6.1, " keeps its comma; it is committed on blur.
  return (
    <input
      value={draft ?? joined}
      placeholder="e.g. RL.6.1, L.6.4.a"
      onFocus={() => setDraft(joined)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== undefined) {
          onChange(
            draft
              .split(',')
              .map((c) => c.trim())
              .filter(Boolean),
          );
        }
        setDraft(undefined);
      }}
      className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 font-mono text-sm hover:border-line focus:border-accent focus:bg-paper-raised focus:outline-none"
    />
  );
}

export function SmallButton({
  children,
  onClick,
  tone = 'plain',
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: 'plain' | 'danger';
}) {
  const colors = tone === 'danger' ? 'text-danger hover:bg-danger-soft' : 'text-ink-soft hover:bg-paper-sunk';
  return (
    <button type="button" onClick={onClick} className={`rounded px-2 py-1 text-xs font-medium ${colors}`}>
      {children}
    </button>
  );
}
