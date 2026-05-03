'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@deqah/ui/primitives/button';
import { Input } from '@deqah/ui/primitives/input';
import { Label } from '@deqah/ui/primitives/label';
import { Textarea } from '@deqah/ui/primitives/textarea';
import { useUpdatePlan } from '@/features/plans/update-plan/use-update-plan';
import { PlanFormTabs } from '@/features/plans/plan-form-tabs';
import {
  hydrateLimits,
  mergeLimits,
  type PlanLimits,
  FEATURE_FIELDS,
} from '@/features/plans/plan-limits';
import { DiffPreviewDialog } from '@/features/plans/features-tab/diff-preview-dialog';
import { computeDowngrades } from '@/features/plans/features-tab/diff';
import type { PlanLimits as FeatureLimits } from '@/features/plans/features-tab/presets';
import type { FeatureKey } from '@deqah/shared';
import type { PlanRow } from '@/features/plans/types';

interface FormState {
  nameAr: string;
  nameEn: string;
  priceMonthly: string;
  priceAnnual: string;
  currency: string;
  reason: string;
}

function flatToFeatureLimits(flat: PlanLimits): FeatureLimits {
  const features: Partial<Record<FeatureKey, boolean>> = {};
  for (const f of FEATURE_FIELDS) {
    features[f.key as FeatureKey] = flat[f.key] as boolean;
  }
  return { features, quotas: {} };
}

function countDirty(
  form: { nameAr: string; nameEn: string; priceMonthly: string; priceAnnual: string; currency: string },
  limits: PlanLimits,
  plan: PlanRow,
  savedLimits: PlanLimits,
): number {
  let count = 0;
  if (form.nameAr !== plan.nameAr) count++;
  if (form.nameEn !== plan.nameEn) count++;
  if (form.priceMonthly !== String(plan.priceMonthly)) count++;
  if (form.priceAnnual !== String(plan.priceAnnual)) count++;
  if (form.currency !== plan.currency) count++;
  for (const key of Object.keys(savedLimits) as Array<keyof PlanLimits>) {
    if (limits[key] !== savedLimits[key]) count++;
  }
  return count;
}

export function PlanEditForm({ plan }: { plan: PlanRow }) {
  const router = useRouter();
  const mutation = useUpdatePlan();
  const activeSubscribers = plan._count.subscriptions;

  const [form, setForm] = useState<FormState>(() => ({
    nameAr: plan.nameAr,
    nameEn: plan.nameEn,
    priceMonthly: String(plan.priceMonthly),
    priceAnnual: String(plan.priceAnnual),
    currency: plan.currency,
    reason: '',
  }));
  const [limits, setLimits] = useState<PlanLimits>(() => hydrateLimits(plan.limits));
  const [savedLimits] = useState<PlanLimits>(() => hydrateLimits(plan.limits));
  const [diffDialogOpen, setDiffDialogOpen] = useState(false);
  const [pendingDowngrades, setPendingDowngrades] = useState<FeatureKey[]>([]);

  const isValid =
    form.nameAr.trim().length > 0 &&
    form.nameEn.trim().length > 0 &&
    form.priceMonthly !== '' &&
    form.priceAnnual !== '' &&
    form.reason.trim().length >= 10;

  const dirtyCount = countDirty(form, limits, plan, savedLimits);

  const set = (field: keyof FormState) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const doSave = () => {
    mutation.mutate(
      {
        planId: plan.id,
        nameAr: form.nameAr.trim(),
        nameEn: form.nameEn.trim(),
        priceMonthly: Number(form.priceMonthly),
        priceAnnual: Number(form.priceAnnual),
        currency: form.currency.trim() || 'SAR',
        limits: mergeLimits(plan.limits, limits),
        reason: form.reason.trim(),
      },
      { onSuccess: () => router.push('/plans') },
    );
  };

  const submit = () => {
    if (!isValid) return;
    const savedFeatures = flatToFeatureLimits(savedLimits);
    const draftFeatures = flatToFeatureLimits(limits);
    const downgrades = computeDowngrades(savedFeatures, draftFeatures);
    if (activeSubscribers > 0 && downgrades.length > 0) {
      setPendingDowngrades(downgrades);
      setDiffDialogOpen(true);
    } else {
      doSave();
    }
  };

  const general = (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="up-nameAr">Name (Arabic)</Label>
          <Input
            id="up-nameAr"
            value={form.nameAr}
            onChange={(e) => set('nameAr')(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="up-nameEn">Name (English)</Label>
          <Input
            id="up-nameEn"
            value={form.nameEn}
            onChange={(e) => set('nameEn')(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="up-monthly">Monthly price</Label>
          <Input
            id="up-monthly"
            type="number"
            min={0}
            value={form.priceMonthly}
            onChange={(e) => set('priceMonthly')(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="up-annual">Annual price</Label>
          <Input
            id="up-annual"
            type="number"
            min={0}
            value={form.priceAnnual}
            onChange={(e) => set('priceAnnual')(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="up-currency">Currency</Label>
          <Input
            id="up-currency"
            value={form.currency}
            onChange={(e) => set('currency')(e.target.value)}
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/plans"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to plans
        </Link>
        <h2 className="mt-2 text-2xl font-semibold">
          Edit plan — <span className="font-mono text-xl">{plan.slug}</span>
        </h2>
        <p className="text-sm text-muted-foreground">
          Update plan details, quotas, and feature flags. Slug cannot be changed.
        </p>
      </div>

      {activeSubscribers > 0 ? (
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm text-warning">
          <strong>⚠ {activeSubscribers} active subscriber(s).</strong>{' '}
          Price changes won&apos;t apply to existing subscriptions.
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-6">
        <PlanFormTabs
          idPrefix="up"
          general={general}
          limits={limits}
          onLimitsChange={setLimits}
        />
      </div>

      <div className="sticky bottom-0 -mx-6 border-t border-border bg-background px-6 pt-4 pb-4">
        {dirtyCount > 0 && (
          <span className="mb-3 block text-sm text-muted-foreground">
            {dirtyCount} change{dirtyCount === 1 ? '' : 's'} pending
            {form.reason.trim().length < 10
              ? ' — add a reason (min 10 chars) below to save'
              : ''}
          </span>
        )}
        <div className="mb-3 space-y-1.5">
          <Label htmlFor="up-reason">Reason (min 10 chars)</Label>
          <Textarea
            id="up-reason"
            rows={2}
            value={form.reason}
            onChange={(e) => set('reason')(e.target.value)}
            placeholder="Reason for updating this plan…"
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/plans')}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={mutation.isPending || !isValid}
            title={
              !isValid && dirtyCount > 0
                ? 'Add a reason (min 10 chars) in the field below to enable saving.'
                : undefined
            }
          >
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>

      <DiffPreviewDialog
        open={diffDialogOpen}
        onOpenChange={setDiffDialogOpen}
        downgrades={pendingDowngrades}
        activeSubscribers={activeSubscribers}
        onConfirm={() => {
          setDiffDialogOpen(false);
          doSave();
        }}
      />
    </div>
  );
}
