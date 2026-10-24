import { guidanceHistory, loadGenerationContext, promptInputFor, unitBoard } from '@lcg/db';
import { buildLessonPrompt, exampleMarkdown } from '@lcg/generation';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/server/db';
import { requireUser } from '@/server/session';
import { GuidanceEditor } from './GuidanceEditor';

export default async function GuidancePage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  await requireUser();
  const { unitId } = await params;
  const board = await unitBoard(db, unitId);
  if (!board) notFound();
  const history = await guidanceHistory(db, unitId);
  const previewKey = (await searchParams).lesson ?? board.lessons.find((l) => l.lessonType !== 'flex-day')?.key;
  const previewLesson = board.lessons.find((l) => l.key === previewKey);
  const context = previewLesson ? await loadGenerationContext(db, previewLesson.id) : undefined;
  const prompt = context
    ? buildLessonPrompt(promptInputFor(context, exampleMarkdown(context.outline.lessonType)))
    : undefined;

  return (
    <div>
      <div className="text-sm text-ink-soft">
        <Link href={`/units/${unitId}`} className="hover:underline">
          Grade {board.unit.grade} · Unit {board.unit.unitNumber}: {board.unit.title}
        </Link>{' '}
        / Generation Guidance
      </div>
      <h1 className="mt-1 font-serif text-3xl font-semibold">Generation Guidance</h1>
      <p className="mt-2 max-w-3xl text-ink-soft">
        Plain-language instructions that steer how this Unit&apos;s Lessons are written. Each save is a new version, and every
        Lesson records the version that produced it. The output format, Lesson structure and standards rules are fixed and
        not part of the Guidance.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <section>
          <GuidanceEditor unitId={unitId} initialText={history[0]?.text ?? ''} />
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-ink-soft">Versions</h2>
          <ol className="mt-2 space-y-1 text-sm">
            {history.map((version) => (
              <li key={version.id} className="text-ink-soft">
                v{version.version} by {version.authorName}, {version.createdAt.toLocaleString('en-US')}
              </li>
            ))}
          </ol>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Prompt preview</h2>
            <form className="text-sm">
              <label>
                Lesson{' '}
                <select name="lesson" defaultValue={previewKey} className="rounded border border-line bg-paper-raised px-2 py-1">
                  {board.lessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.key}>
                      {lesson.key} {lesson.title}
                    </option>
                  ))}
                </select>
              </label>{' '}
              <button className="rounded border border-line px-2 py-1 hover:border-accent">Show</button>
            </form>
          </div>
          <p className="mt-1 text-sm text-ink-soft">Exactly what the AI receives for this Lesson, with the current Guidance.</p>
          {prompt && (
            <div className="mt-3 space-y-3 text-sm">
              <PromptPart title="Fixed instructions (not editable)" text={prompt.system[0]!.text} />
              <PromptPart title="Unit context and Generation Guidance" text={prompt.system[1]!.text} open />
              <PromptPart title="Example Lesson of the same type (from Units 1-3)" text={prompt.system[2]!.text} />
              <PromptPart title="This Lesson" text={prompt.user} open />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PromptPart({ title, text, open }: { title: string; text: string; open?: boolean }) {
  return (
    <details open={open} className="rounded-lg border border-line bg-paper-raised">
      <summary className="cursor-pointer px-3 py-2 font-medium">
        {title} <span className="font-normal text-ink-faint">· {text.length.toLocaleString('en-US')} characters</span>
      </summary>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap border-t border-line px-3 py-2 font-mono text-xs leading-relaxed text-ink-soft">
        {text}
      </pre>
    </details>
  );
}
