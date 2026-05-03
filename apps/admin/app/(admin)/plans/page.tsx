'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@deqah/ui/primitives/button';
import { useListPlans } from '@/features/plans/list-plans/use-list-plans';
import { PlansTable } from '@/features/plans/list-plans/plans-table';
import { DeletePlanDialog } from '@/features/plans/delete-plan/delete-plan-dialog';
import { updatePlan } from '@/features/plans/update-plan/update-plan.api';
import type { PlanRow } from '@/features/plans/types';

export default function PlansPage() {
  const { data, isLoading, error } = useListPlans();
  const [deletePlan, setDeletePlan] = useState<PlanRow | null>(null);
  const queryClient = useQueryClient();

  const toggleVisibleMutation = useMutation({
    mutationFn: ({ plan, visible }: { plan: PlanRow; visible: boolean }) =>
      updatePlan({ planId: plan.id, isVisible: visible, reason: 'Toggle plan visibility' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plans', 'list'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Plans</h2>
          <p className="text-sm text-muted-foreground">Subscription plans available to tenants.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/plans/edit">Edit Features & Limits</Link>
          </Button>
          <Button asChild>
            <Link href="/plans/new">+ Create Plan</Link>
          </Button>
        </div>
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
        onToggleVisible={(plan, visible) => toggleVisibleMutation.mutate({ plan, visible })}
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
