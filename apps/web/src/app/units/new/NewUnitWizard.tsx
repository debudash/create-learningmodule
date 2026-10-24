'use client';

import type { OutlineSource } from '@lcg/db';
import type { ImportProposal, Resolution, UnitEdits } from '@lcg/outline';
import { unresolvedBlocking } from '@lcg/outline/issues';
import { useState, useTransition } from 'react';
import { PrimaryButton } from '@/components/PrimaryButton';
import { checkImportAction, createUnitAction } from './actions';
import { GuidanceStep } from './GuidanceStep';
import { ImportPreview, unitFieldsOf, type UnitFields } from './ImportPreview';
import { OutlineStep } from './OutlineStep';

const STEPS = ['Unit Outline', 'Import preview', 'Generation Guidance'] as const;

interface Imported {
  proposal: ImportProposal;
  source: OutlineSource;
  /** The server's seal over the proposal; it refuses a proposal changed in the browser. */
  seal: string;
}

/**
 * The New Unit wizard. The proposal lives here in the browser between steps;
 * the server confirms it again before anything is created.
 */
export function NewUnitWizard({ defaultGuidance }: { defaultGuidance: string }) {
  const [step, setStep] = useState(0);
  const [imported, setImported] = useState<Imported>();
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [fields, setFields] = useState<UnitFields>();
  const [guidance, setGuidance] = useState(defaultGuidance);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const onRead = (next: Imported) => {
    setImported(next);
    setResolutions([]);
    setFields(unitFieldsOf(next.proposal));
    setErrors([]);
    setStep(1);
  };

  const decisions = () => ({
    proposal: imported!.proposal,
    source: imported!.source,
    seal: imported!.seal,
    resolutions,
    unitEdits: toUnitEdits(fields!),
  });

  const onContinue = () =>
    startTransition(async () => {
      const result = await checkImportAction(decisions());
      setErrors(result.ok ? [] : result.errors);
      if (result.ok) setStep(2);
    });

  const onCreate = () =>
    startTransition(async () => {
      const result = await createUnitAction({ ...decisions(), guidance });
      setErrors(result.errors);
    });

  const back = () => {
    setErrors([]);
    setStep(step - 1);
  };

  return (
    <div className="mt-4">
      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`rounded-full px-3 py-1 font-medium ${
              i === step
                ? 'bg-accent text-white'
                : i < step
                  ? 'bg-accent-soft text-accent'
                  : 'bg-paper-sunk text-ink-soft'
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      <div className="mt-6">
        {step === 0 && <OutlineStep onRead={onRead} />}
        {step === 1 && imported && fields && (
          <ImportPreview
            proposal={imported.proposal}
            fields={fields}
            onFieldsChange={setFields}
            resolutions={resolutions}
            onResolutionsChange={setResolutions}
          />
        )}
        {step === 2 && <GuidanceStep guidance={guidance} onChange={setGuidance} />}
      </div>

      {errors.length > 0 && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-danger bg-danger-soft p-4 text-sm text-danger"
        >
          <p className="font-semibold">The Unit cannot be created yet:</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {step > 0 && (
        <div className="sticky bottom-0 mt-6 flex items-center justify-between border-t border-line bg-paper py-4">
          <button
            type="button"
            onClick={back}
            className="rounded-lg px-4 py-2 text-ink-soft hover:bg-paper-sunk"
          >
            Back
          </button>
          {step === 1 && imported && (
            <ContinueButton
              blocking={unresolvedBlocking(imported.proposal.issues, resolutions).length}
              pending={pending}
              onClick={onContinue}
            />
          )}
          {step === 2 && (
            <PrimaryButton disabled={pending || !guidance.trim()} onClick={onCreate}>
              {pending ? 'Creating the Unit…' : 'Create Unit'}
            </PrimaryButton>
          )}
        </div>
      )}
    </div>
  );
}

function ContinueButton({
  blocking,
  pending,
  onClick,
}: {
  blocking: number;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      {blocking > 0 && (
        <span className="text-sm text-danger">
          Resolve {blocking} Blocking issue{blocking === 1 ? '' : 's'} to continue
        </span>
      )}
      <PrimaryButton disabled={blocking > 0 || pending} onClick={onClick}>
        {pending ? 'Checking…' : 'Continue'}
      </PrimaryButton>
    </div>
  );
}

function toUnitEdits(fields: UnitFields): UnitEdits {
  return {
    title: fields.title.trim(),
    grade: Number(fields.grade),
    unitNumber: Number(fields.unitNumber),
    anchorText: {
      title: fields.anchorTitle.trim(),
      author: fields.anchorAuthor.trim(),
      isbn: fields.isbn.trim() || undefined,
    },
    performanceTask: fields.performanceTask.trim() || undefined,
  };
}
