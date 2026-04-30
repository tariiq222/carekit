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
import { Input } from '@deqah/ui/primitives/input';
import { Label } from '@deqah/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@deqah/ui/primitives/select';
import { Textarea } from '@deqah/ui/primitives/textarea';
import { useCreateTenant } from './use-create-tenant';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_FORM = {
  slug: '',
  nameAr: '',
  nameEn: '',
  ownerUserId: '',
  verticalSlug: '',
  planId: '',
  billingCycle: 'MONTHLY' as 'MONTHLY' | 'ANNUAL',
  trialDays: '14',
  reason: '',
};

type FormState = typeof DEFAULT_FORM;

export function CreateTenantDialog({ open, onOpenChange }: Props) {
  const t = useTranslations('organizations.create');
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const mutation = useCreateTenant();

  const trialDaysValue = form.trialDays.trim() === '' ? undefined : Number(form.trialDays);
  const trialDaysValid =
    trialDaysValue === undefined ||
    (Number.isInteger(trialDaysValue) && trialDaysValue >= 0 && trialDaysValue <= 90);
  const canSubmit =
    SLUG_REGEX.test(form.slug.trim()) &&
    form.nameAr.trim().length >= 2 &&
    UUID_REGEX.test(form.ownerUserId.trim()) &&
    form.reason.trim().length >= 10 &&
    trialDaysValid;

  const set = (field: keyof FormState) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const reset = () => {
    setForm(DEFAULT_FORM);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !mutation.isPending) {
      reset();
      mutation.reset();
    }
    onOpenChange(next);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || mutation.isPending) return;

    mutation.mutate(
      {
        slug: form.slug.trim(),
        nameAr: form.nameAr.trim(),
        nameEn: form.nameEn.trim() || undefined,
        ownerUserId: form.ownerUserId.trim(),
        verticalSlug: form.verticalSlug.trim() || undefined,
        planId: form.planId.trim() || undefined,
        billingCycle: form.billingCycle,
        trialDays: trialDaysValue,
        reason: form.reason.trim(),
      },
      {
        onSuccess: () => {
          handleOpenChange(false);
        },
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

          <DialogBody>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tenant-slug">{t('slug')}</Label>
                <Input
                  id="tenant-slug"
                  value={form.slug}
                  onChange={(event) => set('slug')(event.target.value)}
                  placeholder={t('slugPlaceholder')}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tenant-owner">{t('ownerUserId')}</Label>
                <Input
                  id="tenant-owner"
                  value={form.ownerUserId}
                  onChange={(event) => set('ownerUserId')(event.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tenant-name-ar">{t('nameAr')}</Label>
                <Input
                  id="tenant-name-ar"
                  value={form.nameAr}
                  onChange={(event) => set('nameAr')(event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tenant-name-en">{t('nameEn')}</Label>
                <Input
                  id="tenant-name-en"
                  value={form.nameEn}
                  onChange={(event) => set('nameEn')(event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tenant-vertical">{t('verticalSlug')}</Label>
                <Input
                  id="tenant-vertical"
                  value={form.verticalSlug}
                  onChange={(event) => set('verticalSlug')(event.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tenant-plan">{t('planId')}</Label>
                <Input
                  id="tenant-plan"
                  value={form.planId}
                  onChange={(event) => set('planId')(event.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tenant-billing-cycle">{t('billingCycle')}</Label>
                <Select
                  value={form.billingCycle}
                  onValueChange={(value) => set('billingCycle')(value)}
                >
                  <SelectTrigger id="tenant-billing-cycle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">{t('monthly')}</SelectItem>
                    <SelectItem value="ANNUAL">{t('annual')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tenant-trial-days">{t('trialDays')}</Label>
                <Input
                  id="tenant-trial-days"
                  min={0}
                  max={90}
                  type="number"
                  value={form.trialDays}
                  onChange={(event) => set('trialDays')(event.target.value)}
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="tenant-reason">{t('reason')}</Label>
                <Textarea
                  id="tenant-reason"
                  rows={3}
                  value={form.reason}
                  onChange={(event) => set('reason')(event.target.value)}
                />
              </div>
            </div>

            {errorMessage ? (
              <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={mutation.isPending}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending || !canSubmit}>
              {mutation.isPending ? t('submitting') : t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
