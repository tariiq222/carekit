'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@carekit/ui/primitives/badge';
import { Button } from '@carekit/ui/primitives/button';
import { Input } from '@carekit/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@carekit/ui/primitives/select';
import { Skeleton } from '@carekit/ui/primitives/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carekit/ui/primitives/table';
import { adminApi, type OrganizationsPage } from '@/lib/api';

export default function OrganizationsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [suspended, setSuspended] = useState<'all' | 'true' | 'false'>('all');

  const params = new URLSearchParams({ page: String(page), perPage: '20' });
  if (search.trim()) params.set('search', search.trim());
  if (suspended !== 'all') params.set('suspended', suspended);

  const { data, isLoading, error } = useQuery<OrganizationsPage>({
    queryKey: ['organizations', page, search, suspended],
    queryFn: () => adminApi.listOrganizations(params),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Organizations</h2>
          <p className="text-sm text-muted-foreground">
            Every tenant on the platform. Suspend to freeze access, reinstate to restore.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3">
        <Input
          placeholder="Search by slug, Arabic or English name"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <Select
          value={suspended}
          onValueChange={(v) => {
            setSuspended(v as 'all' | 'true' | 'false');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="false">Active only</SelectItem>
            <SelectItem value="true">Suspended only</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearch('');
            setSuspended('all');
            setPage(1);
          }}
        >
          Reset
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Slug</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && !data
            ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6" />
                  </TableCell>
                </TableRow>
              ))
            : data?.items.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-mono text-xs">{org.slug}</TableCell>
                  <TableCell>
                    <div className="font-medium">{org.nameAr}</div>
                    {org.nameEn ? (
                      <div className="text-xs text-muted-foreground">{org.nameEn}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {org.suspendedAt ? (
                      <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                        Suspended
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(org.createdAt).toLocaleDateString('en-GB', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/organizations/${org.id}`}>Open</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          {!isLoading && data?.items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                No organizations match the current filters.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

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
