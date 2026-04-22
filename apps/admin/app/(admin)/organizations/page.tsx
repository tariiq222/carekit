'use client';

import { useState } from 'react';
import { Button } from '@carekit/ui/primitives/button';
import { useListOrganizations } from '@/features/organizations/list-organizations/use-list-organizations';
import {
  OrganizationsFilterBar,
  type SuspendedFilter,
} from '@/features/organizations/list-organizations/organizations-filter-bar';
import { OrganizationsTable } from '@/features/organizations/list-organizations/organizations-table';

export default function OrganizationsListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [suspended, setSuspended] = useState<SuspendedFilter>('all');

  const { data, isLoading, error } = useListOrganizations({
    page,
    perPage: 20,
    search: search.trim() || undefined,
    suspended: suspended === 'all' ? undefined : suspended,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Organizations</h2>
        <p className="text-sm text-muted-foreground">
          Every tenant on the platform. Suspend to freeze access, reinstate to restore.
        </p>
      </div>

      <OrganizationsFilterBar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        suspended={suspended}
        onSuspendedChange={(v) => {
          setSuspended(v);
          setPage(1);
        }}
        onReset={() => {
          setSearch('');
          setSuspended('all');
          setPage(1);
        }}
      />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </div>
      ) : null}

      <OrganizationsTable items={data?.items} isLoading={isLoading} />

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
