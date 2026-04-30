'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@deqah/ui/primitives/button';
import { Input } from '@deqah/ui/primitives/input';
import { Label } from '@deqah/ui/primitives/label';
import { Textarea } from '@deqah/ui/primitives/textarea';
import { useCreatePlan } from '@/features/plans/create-plan/use-create-plan';
import { PlanFormTabs } from '@/features/plans/plan-form-tabs';
import { DEFAULT_PLAN_LIMITS, type PlanLimits } from '@/features/plans/plan-limits';

const SLUG_REGEX = /^[A-Z][A-Z0-9_]{1,31}$/;

const DEFAULT_FORM = {
  slug: '',
  nameAr: '',
  nameEn: '',
  priceMonthly: '',
  priceAnnual: '',
  currency: 'SAR',
  reason: '',
};

export default function CreatePlanPage() {
  const router = useRouter();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [limits, setLimits] = useState<PlanLimits>(DEFAULT_PLAN_LIMITS);
  const mutation = useCreatePlan();

  const slugIsValid = SLUG_REGEX.test(form.slug);
  const isValid =
    slugIsValid &&
    form.nameAr.trim().length > 0 &&
    form.nameEn.trim().length > 0 &&
    form.priceMonthly !== '' &&
    form.priceAnnual !== '' &&
    form.reason.trim().length >= 10;

  const set = (field: keyof typeof DEFAULT_FORM) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const submit = () => {
    if (!isValid) return;
    mutation.mutate(
      {
        slug: form.slug,
        nameAr: form.nameAr.trim(),
        nameEn: form.nameEn.trim(),
        priceMonthly: Number(form.priceMonthly),
        priceAnnual: Number(form.priceAnnual),
        currency: form.currency.trim() || 'SAR',
        limits: { ...limits },
        isActive: true,
        reason: form.reason.trim(),
      },
      { onSuccess: () => router.push('/plans') },
    );
  };

  const general = (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="cp-slug">Slug</Label>
        <Input
          id="cp-slug"
          value={form.slug}
          onChange={(e) => set('slug')(e.target.value.toUpperCase())}
          placeholder="STARTER"
          autoComplete="off"
          aria-invalid={form.slug !== '' && !slugIsValid}
        />
        <p className="text-xs text-muted-foreground">
          Uppercase letters, digits, underscores. 2–32 chars. Example: STARTER, TEAM_ANNUAL.
        </p>
        {form.slug !== '' && !slugIsValid ? (
          <p className="text-xs text-destructive">Invalid slug format.</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cp-nameAr">Name (Arabic)</Label>
          <Input
            id="cp-nameAr"
            value={form.nameAr}
            onChange={(e) => set('nameAr')(e.target.value)}
            placeholder="اسم الخطة"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cp-nameEn">Name (English)</Label>
          <Input
            id="cp-nameEn"
            value={form.nameEn}
            onChange={(e) => set('nameEn')(e.target.value)}
            placeholder="Plan name"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cp-monthly">Monthly price</Label>
          <Input
            id="cp-monthly"
            type="number"
            min={0}
            value={form.priceMonthly}
            onChange={(e) => set('priceMonthly')(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cp-annual">Annual price</Label>
          <Input
            id="cp-annual"
            type="number"
            min={0}
            value={form.priceAnnual}
            onChange={(e) => set('priceAnnual')(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cp-currency">Currency</Label>
          <Input
            id="cp-currency"
            value={form.currency}
            onChange={(e) => set('currency')(e.target.value)}
            placeholder="SAR"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cp-reason">Reason (min 10 chars)</Label>
        <Textarea
          id="cp-reason"
          rows={3}
          value={form.reason}
          onChange={(e) => set('reason')(e.target.value)}
          placeholder="Reason for creating this plan…"
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
        <h2 className="mt-2 text-2xl font-semibold">Create plan</h2>
        <p className="text-sm text-muted-foreground">
          Add a new subscription plan. Reason is written to the audit log.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <PlanFormTabs
          idPrefix="cp"
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
          {mutation.isPending ? 'Creating…' : 'Create plan'}
        </Button>
      </div>
    </div>
  );
}
