'use client';

import { useState } from 'react';
import { Button } from '@carekit/ui/primitives/button';
import { useListPlans } from '@/features/plans/list-plans/use-list-plans';
import { PlansTable } from '@/features/plans/list-plans/plans-table';
import { CreatePlanDialog } from '@/features/plans/create-plan/create-plan-dialog';
import { UpdatePlanDialog } from '@/features/plans/update-plan/update-plan-dialog';
import { DeletePlanDialog } from '@/features/plans/delete-plan/delete-plan-dialog';
import type { PlanRow } from '@/features/plans/types';

export default function PlansPage() {
  const { data, isLoading, error } = useListPlans();
  const [createOpen, setCreateOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<PlanRow | null>(null);
  const [deletePlan, setDeletePlan] = useState<PlanRow | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Plans</h2>
          <p className="text-sm text-muted-foreground">
            Subscription plans available to tenants.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ Create Plan</Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </div>
      ) : null}

      <PlansTable
        items={data}
        isLoading={isLoading}
        onEdit={(plan) => setEditPlan(plan)}
        onDelete={(plan) => setDeletePlan(plan)}
      />

      <CreatePlanDialog open={createOpen} onOpenChange={setCreateOpen} />

      {editPlan ? (
        <UpdatePlanDialog
          open={editPlan !== null}
          onOpenChange={(open) => { if (!open) setEditPlan(null); }}
          plan={editPlan}
        />
      ) : null}

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
