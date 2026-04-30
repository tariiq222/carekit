'use client';

import { useState } from 'react';
import { Button } from '@deqah/ui/primitives/button';
import { useListSubscriptionInvoices } from '@/features/billing/list-subscription-invoices/use-list-subscription-invoices';
import {
  InvoicesFilterBar,
  type InvoiceStatusFilter,
} from '@/features/billing/list-subscription-invoices/invoices-filter-bar';
import { InvoicesTable } from '@/features/billing/list-subscription-invoices/invoices-table';

export default function BillingInvoicesPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<InvoiceStatusFilter>('all');
  const [organizationId, setOrganizationId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data, isLoading, error } = useListSubscriptionInvoices({
    page,
    perPage: 20,
    status: status === 'all' ? undefined : status,
    organizationId: organizationId.trim() || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Billing — Invoices</h2>
        <p className="text-sm text-muted-foreground">
          Cross-tenant SaaS invoices. Drafts are hidden by default.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </div>
      ) : null}

      <InvoicesFilterBar
        status={status}
        onStatusChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        organizationId={organizationId}
        onOrganizationIdChange={(v) => {
          setOrganizationId(v);
          setPage(1);
        }}
        fromDate={fromDate}
        onFromDateChange={(v) => {
          setFromDate(v);
          setPage(1);
        }}
        toDate={toDate}
        onToDateChange={(v) => {
          setToDate(v);
          setPage(1);
        }}
        onReset={() => {
          setStatus('all');
          setOrganizationId('');
          setFromDate('');
          setToDate('');
          setPage(1);
        }}
      />

      <InvoicesTable items={data?.items} isLoading={isLoading} />

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
