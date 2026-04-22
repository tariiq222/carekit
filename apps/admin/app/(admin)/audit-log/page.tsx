'use client';

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
import { adminApi, type AuditLogPage } from '@/lib/api';

const ACTION_TYPES = [
  'SUSPEND_ORG',
  'REINSTATE_ORG',
  'IMPERSONATE_START',
  'IMPERSONATE_END',
  'RESET_PASSWORD',
  'PLAN_CREATE',
  'PLAN_UPDATE',
  'PLAN_DELETE',
  'VERTICAL_CREATE',
  'VERTICAL_UPDATE',
  'VERTICAL_DELETE',
];

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [actionType, setActionType] = useState<string>('all');
  const [organizationId, setOrganizationId] = useState('');

  const params = new URLSearchParams({ page: String(page), perPage: '50' });
  if (actionType !== 'all') params.set('actionType', actionType);
  if (organizationId.trim()) params.set('organizationId', organizationId.trim());

  const { data, isLoading, error } = useQuery<AuditLogPage>({
    queryKey: ['audit-log', page, actionType, organizationId],
    queryFn: () => adminApi.listAuditLog(params),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Audit log</h2>
        <p className="text-sm text-muted-foreground">
          Every destructive super-admin action. Read-only.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3">
        <Select
          value={actionType}
          onValueChange={(v) => {
            setActionType(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Action type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All action types</SelectItem>
            {ACTION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Organization ID (UUID)"
          value={organizationId}
          onChange={(e) => {
            setOrganizationId(e.target.value);
            setPage(1);
          }}
          className="max-w-sm font-mono text-xs"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setActionType('all');
            setOrganizationId('');
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
            <TableHead>When</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Organization</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>IP</TableHead>
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
            : data?.items.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {entry.actionType}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {entry.organizationId ?? '—'}
                  </TableCell>
                  <TableCell className="max-w-md truncate text-sm">{entry.reason}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {entry.ipAddress || '—'}
                  </TableCell>
                </TableRow>
              ))}
          {!isLoading && data?.items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                No audit entries match the current filters.
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
