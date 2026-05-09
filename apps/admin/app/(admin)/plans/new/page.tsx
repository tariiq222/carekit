'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCreatePlan } from '@/features/plans/create-plan/use-create-plan';
import { DEFAULT_PLAN_LIMITS } from '@/features/plans/plan-limits';
import { PlanWizard } from '@/features/plans/plan-wizard/plan-wizard';
import type { BasicsForm } from '@/features/plans/plan-wizard/step-basics';

const DEFAULT_BASICS: BasicsForm = {
  slug: '',
  nameAr: '',
  nameEn: '',
  priceMonthly: '',
  priceAnnual: '',
  currency: 'SAR',
};

export default function CreatePlanPage() {
  const router = useRouter();
  const mutation = useCreatePlan();

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Link
          href="/plans"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← back to plans
        </Link>
        <h2 className="mt-2 text-xl font-semibold">Create plan</h2>
        <p className="text-sm text-muted-foreground">
          Add a new subscription plan for tenants.
        </p>
      </div>

      <PlanWizard
        mode="create"
        initialBasics={DEFAULT_BASICS}
        initialLimits={DEFAULT_PLAN_LIMITS}
        isSubmitting={mutation.isPending}
        onCancel={() => router.push('/plans')}
        onSubmit={({ basics, limits }) => {
          mutation.mutate(
            {
              slug: basics.slug,
              nameAr: basics.nameAr.trim(),
              nameEn: basics.nameEn.trim(),
              priceMonthly: Number(basics.priceMonthly),
              priceAnnual: Number(basics.priceAnnual),
              currency: basics.currency.trim() || 'SAR',
              limits: { ...limits },
              isActive: true,
            },
            { onSuccess: () => router.push('/plans') },
          );
        }}
      />
    </div>
  );
}
