'use client';

import { useState } from 'react';
import { Button } from '@carekit/ui/primitives/button';
import { useListAuditLog } from '@/features/audit-log/list-audit-log/use-list-audit-log';
import { AuditLogFilterBar } from '@/features/audit-log/list-audit-log/audit-log-filter-bar';
import { AuditLogTable } from '@/features/audit-log/list-audit-log/audit-log-table';

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [actionType, setActionType] = useState<string>('all');
  const [organizationId, setOrganizationId] = useState('');

  const { data, isLoading, error } = useListAuditLog({
    page,
    perPage: 50,
    actionType,
    organizationId,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Audit log</h2>
        <p className="text-sm text-muted-foreground">
          Every destructive super-admin action. Read-only.
        </p>
      </div>

      <AuditLogFilterBar
        actionType={actionType}
        onActionTypeChange={(v) => {
          setActionType(v);
          setPage(1);
        }}
        organizationId={organizationId}
        onOrganizationIdChange={(v) => {
          setOrganizationId(v);
          setPage(1);
        }}
        onReset={() => {
          setActionType('all');
          setOrganizationId('');
          setPage(1);
        }}
      />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </div>
      ) : null}

      <AuditLogTable items={data?.items} isLoading={isLoading} />

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
              onClick={() => setPage((p) => Math.max(1, p - 1))}
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
