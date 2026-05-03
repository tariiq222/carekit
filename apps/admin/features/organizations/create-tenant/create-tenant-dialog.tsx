'use client';

import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@deqah/ui/primitives/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@deqah/ui/primitives/dialog';
import { useCreateTenant } from './use-create-tenant';
import { OwnerStep, isOwnerStepValid } from './steps/owner-step';
import { OrgStep, isOrgStepValid } from './steps/org-step';
import { PlanStep, isPlanStepValid } from './steps/plan-step';
import { ReviewStep, isReviewStepValid } from './steps/review-step';

export type OwnerMode = 'existing' | 'new';

export interface WizardForm {
  ownerMode: OwnerMode;
  ownerUserId: string;
  ownerLabel: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerPassword: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  verticalSlug: string;
  planId: string;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  trialDays: string;
}

const DEFAULT_FORM: WizardForm = {
  ownerMode: 'existing',
  ownerUserId: '',
  ownerLabel: '',
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  ownerPassword: '',
  slug: '',
  nameAr: '',
  nameEn: '',
  verticalSlug: '',
  planId: '',
  billingCycle: 'MONTHLY',
  trialDays: '14',
};

const STEP_LABELS = ['step1', 'step2', 'step3', 'step4'] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTenantDialog({ open, onOpenChange }: Props) {
  const t = useTranslations('organizations.create');
  const [form, setForm] = useState<WizardForm>(DEFAULT_FORM);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const mutation = useCreateTenant();

  const set = (field: keyof WizardForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const reset = () => {
    setForm(DEFAULT_FORM);
    setStep(1);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !mutation.isPending) {
      reset();
      mutation.reset();
    }
    onOpenChange(next);
  };

  const canAdvance =
    step === 1 ? isOwnerStepValid(form) :
    step === 2 ? isOrgStepValid(form) :
    step === 3 ? isPlanStepValid(form) :
    isReviewStepValid(form);

  const handleNext = () => {
    if (step < 4) setStep((s) => (s + 1) as 1 | 2 | 3 | 4);
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAdvance || mutation.isPending) return;

    const trialDaysValue =
      form.trialDays.trim() === '' ? undefined : Number(form.trialDays);

    mutation.mutate(
      {
        slug: form.slug.trim(),
        nameAr: form.nameAr.trim(),
        nameEn: form.nameEn.trim() || undefined,
        ...(form.ownerMode === 'existing'
          ? { ownerUserId: form.ownerUserId.trim() }
          : {
              ownerName: form.ownerName.trim(),
              ownerEmail: form.ownerEmail.trim(),
              ownerPhone: form.ownerPhone.trim() || undefined,
              ownerPassword: form.ownerPassword,
            }),
        verticalSlug: form.verticalSlug.trim() || undefined,
        planId: form.planId.trim() || undefined,
        ...(form.planId.trim() ? { billingCycle: form.billingCycle } : {}),
        trialDays: trialDaysValue,
      },
      {
        onSuccess: () => handleOpenChange(false),
      },
    );
  };

  const errorMessage = mutation.error instanceof Error ? mutation.error.message : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>

          {/* Progress indicator */}
          <div className="flex gap-1 px-6 pt-2">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`h-1.5 w-full rounded-full ${i + 1 <= step ? 'bg-primary' : 'bg-muted'}`}
                />
                <span className="text-xs text-muted-foreground">{t(label)}</span>
              </div>
            ))}
          </div>

          <DialogBody>
            {step === 1 && <OwnerStep form={form} set={set} />}
            {step === 2 && <OrgStep form={form} set={set} />}
            {step === 3 && <PlanStep form={form} set={set} />}
            {step === 4 && (
              <ReviewStep
                form={form}
                onEditStep={(s) => setStep(s)}
                errorMessage={errorMessage}
              />
            )}
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={step === 1 ? () => handleOpenChange(false) : handleBack}
              disabled={mutation.isPending}
            >
              {step === 1 ? t('cancel') : t('back')}
            </Button>

            {step < 4 ? (
              <Button type="button" onClick={handleNext} disabled={!canAdvance}>
                {t('next')}
              </Button>
            ) : (
              <Button type="submit" disabled={mutation.isPending || !canAdvance}>
                {mutation.isPending ? t('submitting') : t('submit')}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
