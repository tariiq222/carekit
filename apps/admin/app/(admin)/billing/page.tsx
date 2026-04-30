'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@deqah/ui/primitives/button';
import { useListSubscriptions } from '@/features/billing/list-subscriptions/use-list-subscriptions';
import {
  SubscriptionsFilterBar,
  type StatusFilter,
} from '@/features/billing/list-subscriptions/subscriptions-filter-bar';
import { SubscriptionsTable } from '@/features/billing/list-subscriptions/subscriptions-table';
import { BillingMetricsGrid } from '@/features/billing/get-billing-metrics/billing-metrics-grid';

export default function BillingSubscriptionsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('all');

  const { data, isLoading, error } = useListSubscriptions({
    page,
    perPage: 20,
    status: status === 'all' ? undefined : status,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Billing — Subscriptions</h2>
          <p className="text-sm text-muted-foreground">
            Every SaaS subscription on the platform. Open a row to see invoices, usage, and credits.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/billing/invoices">All invoices →</Link>
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </div>
      ) : null}

      <BillingMetricsGrid />

      <SubscriptionsFilterBar
        status={status}
        onStatusChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        onReset={() => {
          setStatus('all');
          setPage(1);
        }}
      />

      <SubscriptionsTable items={data?.items} isLoading={isLoading} />

      {data && data.meta.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.meta.page} of {data.meta.totalPages} · {data.meta.total} total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
