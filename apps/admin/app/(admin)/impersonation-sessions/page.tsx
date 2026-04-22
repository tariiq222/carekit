'use client';

import { useState } from 'react';
import { Button } from '@carekit/ui/primitives/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@carekit/ui/primitives/select';
import { useListImpersonationSessions } from '@/features/impersonation/list-impersonation-sessions/use-list-impersonation-sessions';
import { SessionsTable } from '@/features/impersonation/list-impersonation-sessions/sessions-table';

type ActiveFilter = 'all' | 'true' | 'false';

export default function ImpersonationSessionsPage() {
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<ActiveFilter>('all');

  const { data, isLoading, error } = useListImpersonationSessions({
    page,
    perPage: 50,
    active: active === 'all' ? undefined : active,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Impersonation sessions</h2>
        <p className="text-sm text-muted-foreground">
          Active + historical impersonation sessions. End any active session immediately.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3">
        <Select
          value={active}
          onValueChange={(v) => {
            setActive(v as ActiveFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sessions</SelectItem>
            <SelectItem value="true">Active only</SelectItem>
            <SelectItem value="false">Ended / expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </div>
      ) : null}

      <SessionsTable items={data?.items} isLoading={isLoading} />

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
