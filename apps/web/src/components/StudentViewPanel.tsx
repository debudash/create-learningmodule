import { choiceLetter, inlineToNodes, studentView, type Lesson } from '@lcg/lesson-schema';

/** Renders inline Markdown (**bold**, *italic*) as React elements. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {inlineToNodes(text).map((node, i) => {
        const names = (node.marks ?? []).map((m) => m.type);
        let el: React.ReactNode = node.text;
        if (names.includes('italic')) el = <em>{el}</em>;
        if (names.includes('bold')) el = <strong>{el}</strong>;
        return <span key={i}>{el}</span>;
      })}
    </>
  );
}

/** The Lesson exactly as students will see it. */
export function StudentViewPanel({ lesson }: { lesson: Lesson }) {
  const view = studentView(lesson);
  return (
    <article className="rounded-xl border border-line bg-paper-raised p-8">
      <div className="text-sm font-medium text-accent">Student View</div>
      <h1 className="mt-1 font-serif text-2xl font-semibold">{view.title}</h1>
      <h2 className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-soft">Today I will</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {view.objectives.map((objective, i) => (
          <li key={i}>
            <Inline text={objective} />
          </li>
        ))}
      </ul>
      {view.sections.map((section) => (
        <section key={section.kind} className="mt-8">
          <h2 className="font-serif text-xl font-semibold">{section.title}</h2>
          {section.activities.map((activity) => (
            <div key={activity.id} className="mt-4">
              <h3 className="font-semibold">
                {activity.title}
                {activity.routine && <span className="ml-2 text-sm font-normal text-ink-soft">{activity.routine}</span>}
              </h3>
              {activity.blocks.map((block, i) =>
                block.type === 'text-reference' ? (
                  <p key={i} className="mt-2 rounded-md bg-paper-sunk px-3 py-2 text-sm">
                    <strong>Text: </strong>
                    {block.title}
                    {block.pages && <span className="text-ink-soft"> ({block.pages})</span>}
                  </p>
                ) : block.type === 'pulse-check' ? (
                  <div key={i} className="mt-2 rounded-md border border-line p-3">
                    <div className="font-medium">
                      <Inline text={block.stem} />
                    </div>
                    <ol className="mt-2 space-y-1">
                      {block.choices.map((choice, j) => (
                        <li key={j}>
                          {choiceLetter(j)}. <Inline text={choice} />
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <p key={i} className="mt-2 leading-relaxed">
                    {block.type === 'directions' && <strong>Directions: </strong>}
                    <Inline text={block.text} />
                  </p>
                ),
              )}
            </div>
          ))}
        </section>
      ))}
    </article>
  );
}
