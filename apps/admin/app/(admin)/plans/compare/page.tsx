'use client';

import Link from 'next/link';
import { Skeleton } from '@deqah/ui/primitives/skeleton';
import { useListPlans } from '@/features/plans/list-plans/use-list-plans';
import { ComparePlansMatrix } from '@/features/plans/compare-plans/compare-plans-matrix';

export default function ComparePlansPage() {
  const { data, isLoading } = useListPlans();

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Link
          href="/plans"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Plans
        </Link>
        <h2 className="mt-2 text-xl font-semibold">Compare plans</h2>
        <p className="text-sm text-muted-foreground">
          Feature limits across all plans side by side. Edit any cell to stage a change.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-sm" />
          <Skeleton className="h-64 w-full rounded-sm" />
        </div>
      ) : (
        <ComparePlansMatrix plans={data ?? []} />
      )}
    </div>
  );
}
