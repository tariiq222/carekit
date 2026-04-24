'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useMemo, useState } from 'react';
import { Button } from '@carekit/ui/primitives/button';
import { Input } from '@carekit/ui/primitives/input';
import { Label } from '@carekit/ui/primitives/label';
import { Skeleton } from '@carekit/ui/primitives/skeleton';
import { Textarea } from '@carekit/ui/primitives/textarea';
import { useListPlans } from '@/features/plans/list-plans/use-list-plans';
import { useUpdatePlan } from '@/features/plans/update-plan/use-update-plan';
import { PlanFormTabs } from '@/features/plans/plan-form-tabs';
import {
  hydrateLimits,
  mergeLimits,
  type PlanLimits,
} from '@/features/plans/plan-limits';

interface FormState {
  nameAr: string;
  nameEn: string;
  priceMonthly: string;
  priceAnnual: string;
  currency: string;
  reason: string;
}

export default function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isLoading, error } = useListPlans();
  const plan = useMemo(() => data?.find((p) => p.id === id), [data, id]);

  const [form, setForm] = useState<FormState | null>(null);
  const [limits, setLimits] = useState<PlanLimits | null>(null);

  useEffect(() => {
    if (plan && form === null) {
      setForm({
        nameAr: plan.nameAr,
        nameEn: plan.nameEn,
        priceMonthly: String(plan.priceMonthly),
        priceAnnual: String(plan.priceAnnual),
        currency: plan.currency,
        reason: '',
      });
      setLimits(hydrateLimits(plan.limits));
    }
  }, [plan, form]);

  const mutation = useUpdatePlan();

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load: {(error as Error).message}
      </div>
    );
  }

  if (isLoading || !plan || !form || !limits) {
    return <Skeleton className="h-96" />;
  }

  const isValid =
    form.nameAr.trim().length > 0 &&
    form.nameEn.trim().length > 0 &&
    form.priceMonthly !== '' &&
    form.priceAnnual !== '' &&
    form.reason.trim().length >= 10;

  const set = (field: keyof FormState) => (value: string) =>
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));

  const submit = () => {
    if (!isValid) return;
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

      <div className="space-y-1.5">
        <Label htmlFor="up-reason">Reason (min 10 chars)</Label>
        <Textarea
          id="up-reason"
          rows={3}
          value={form.reason}
          onChange={(e) => set('reason')(e.target.value)}
          placeholder="Reason for updating this plan…"
        />
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

      <div className="rounded-lg border border-border bg-card p-6">
        <PlanFormTabs
          idPrefix="up"
          general={general}
          limits={limits}
          onLimitsChange={setLimits}
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
        <Button onClick={submit} disabled={mutation.isPending || !isValid}>
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}
