'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@deqah/ui/primitives/button';
import { useListPlans } from '@/features/plans/list-plans/use-list-plans';
import { PlansTable } from '@/features/plans/list-plans/plans-table';
import { DeletePlanDialog } from '@/features/plans/delete-plan/delete-plan-dialog';
import type { PlanRow } from '@/features/plans/types';

export default function PlansPage() {
  const { data, isLoading, error } = useListPlans();
  const [deletePlan, setDeletePlan] = useState<PlanRow | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Plans</h2>
          <p className="text-sm text-muted-foreground">
            Subscription plans available to tenants.{' '}
            <Link href="/plans/compare" className="text-sm text-primary hover:underline">
              Edit all plans →
            </Link>
          </p>
        </div>
        <Button asChild>
          <Link href="/plans/new">+ Create Plan</Link>
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </div>
      ) : null}

      <PlansTable
        items={data}
        isLoading={isLoading}
        onDelete={(plan) => setDeletePlan(plan)}
      />

      {deletePlan ? (
        <DeletePlanDialog
          open={deletePlan !== null}
          onOpenChange={(open) => { if (!open) setDeletePlan(null); }}
          plan={deletePlan}
        />
      ) : null}
    </div>
  );
}
