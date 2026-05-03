'use client';

import Link from 'next/link';
import { Skeleton } from '@deqah/ui/primitives/skeleton';
import { useListPlans } from '@/features/plans/list-plans/use-list-plans';
import { ComparePlansMatrix } from '@/features/plans/compare-plans/compare-plans-matrix';

export default function PlansEditPage() {
  const { data, isLoading, error } = useListPlans();

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <Link
          href="/plans"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to plans
        </Link>
        <h2 className="mt-2 text-2xl font-semibold">Edit Plans</h2>
        <p className="text-sm text-muted-foreground">
          Configure features and limits across every plan from one screen.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </div>
      ) : null}

      {isLoading && !data ? (
        <Skeleton className="h-96" />
      ) : data ? (
        <ComparePlansMatrix plans={data} />
      ) : null}
    </div>
  );
}
