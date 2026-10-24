'use client';

/** Step 3: the Unit's Generation Guidance, starting from the default. */
export function GuidanceStep({
  guidance,
  onChange,
}: {
  guidance: string;
  onChange: (guidance: string) => void;
}) {
  return (
    <div className="max-w-3xl">
      <h2 className="font-serif text-xl font-semibold">Generation Guidance</h2>
      <p className="mt-1 text-ink-soft">
        Tell the AI how you want this Unit&apos;s Lessons written: tone, pacing, teaching
        preferences. Plain language is fine. The default below gives a good first draft, so you can
        leave it as it is.
      </p>
      <p className="mt-2 text-sm text-ink-soft">
        You do not need to describe the output format or the Lesson structure (Sections, timings,
        standards tagging): those are fixed by the tool and are not part of the guidance. You can
        change the guidance later; each Lesson records which version it was generated with.
      </p>
      <textarea
        value={guidance}
        onChange={(e) => onChange(e.target.value)}
        rows={14}
        aria-label="Generation Guidance"
        className="mt-4 w-full resize-y rounded-lg border border-line bg-paper-raised px-3 py-2 leading-relaxed focus:border-accent focus:outline-none"
      />
    </div>
  );
}
