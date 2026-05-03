'use client';

import { use, useMemo } from 'react';
import { Skeleton } from '@deqah/ui/primitives/skeleton';
import { useListPlans } from '@/features/plans/list-plans/use-list-plans';
import { PlanEditForm } from './plan-edit-form';

export default function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useListPlans();
  const plan = useMemo(() => data?.find((p) => p.id === id), [data, id]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load: {(error as Error).message}
      </div>
    );
  }

  if (isLoading || !plan) {
    return <Skeleton className="h-96" />;
  }

  // Mount the editable form only after plan is available.
  // The `key` ensures useState lazy initializers re-run if the user navigates
  // between two plan ids without unmounting the route.
  return <PlanEditForm key={plan.id} plan={plan} />;
}
