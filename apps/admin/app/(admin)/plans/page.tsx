'use client';

import { useListPlans } from '@/features/plans/list-plans/use-list-plans';
import { PlansTable } from '@/features/plans/list-plans/plans-table';

export default function PlansPage() {
  const { data, isLoading, error } = useListPlans();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Plans</h2>
        <p className="text-sm text-muted-foreground">
          Subscription plans available to tenants. Create, update, or soft-delete via the API
          (dedicated UI lands in a follow-up).
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </div>
      ) : null}

      <PlansTable items={data} isLoading={isLoading} />
    </div>
  );
}
