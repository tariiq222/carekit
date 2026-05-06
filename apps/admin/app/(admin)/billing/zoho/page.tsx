'use client';

import { useState } from 'react';
import { Button } from '@deqah/ui/primitives/button';
import { useListZohoSaasInvoices } from '@/features/billing/list-zoho-saas-invoices/use-list-zoho-saas-invoices';
import { ZohoInvoicesTable } from '@/features/billing/list-zoho-saas-invoices/zoho-invoices-table';

type StatusFilter = 'all' | 'PAID' | 'DUE' | 'FAILED' | 'VOID';
type MirroredFilter = 'all' | 'yes' | 'no';

export default function BillingZohoSchedulePage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [mirrored, setMirrored] = useState<MirroredFilter>('all');
  const [organizationId, setOrganizationId] = useState('');

  const { data, isLoading, error } = useListZohoSaasInvoices({
    page,
    perPage: 25,
    status: status === 'all' ? undefined : status,
    organizationId: organizationId.trim() || undefined,
    zohoMirrored: mirrored === 'all' ? undefined : mirrored,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Zoho — Tenant invoices schedule</h2>
          <p className="text-sm text-muted-foreground">
            Every SaaS subscription invoice and its mirror status in Deqah&rsquo;s platform Zoho organization.
            The next-charge column shows when the parent subscription is due to be billed again.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/20 p-3">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Status</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              setPage(1);
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">All</option>
            <option value="PAID">Paid</option>
            <option value="DUE">Due</option>
            <option value="FAILED">Failed</option>
            <option value="VOID">Void</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Zoho mirror</label>
          <select
            value={mirrored}
            onChange={(e) => {
              setMirrored(e.target.value as MirroredFilter);
              setPage(1);
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">All</option>
            <option value="yes">Mirrored only</option>
            <option value="no">Not mirrored only</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Organization id</label>
          <input
            value={organizationId}
            onChange={(e) => {
              setOrganizationId(e.target.value);
              setPage(1);
            }}
            placeholder="org-uuid"
            className="h-9 rounded-md border bg-background px-3 text-sm"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setStatus('all');
            setMirrored('all');
            setOrganizationId('');
            setPage(1);
          }}
        >
          Reset
        </Button>
      </div>

      <ZohoInvoicesTable items={data?.items} isLoading={isLoading} />

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
