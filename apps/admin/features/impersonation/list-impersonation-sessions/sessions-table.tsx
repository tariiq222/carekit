'use client';

import { Badge } from '@carekit/ui/primitives/badge';
import { Button } from '@carekit/ui/primitives/button';
import { Skeleton } from '@carekit/ui/primitives/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carekit/ui/primitives/table';
import { useEndImpersonation } from '../end-impersonation/use-end-impersonation';
import type { ImpersonationSession } from '../types';

interface Props {
  items: ImpersonationSession[] | undefined;
  isLoading: boolean;
}

export function SessionsTable({ items, isLoading }: Props) {
  const endMutation = useEndImpersonation();
  const now = Date.now();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Started</TableHead>
          <TableHead>Super-admin</TableHead>
          <TableHead>Target user</TableHead>
          <TableHead>Organization</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading && !items
          ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={6}>
                  <Skeleton className="h-6" />
                </TableCell>
              </TableRow>
            ))
          : items?.map((s) => {
              const expired = new Date(s.expiresAt).getTime() <= now;
              const active = !s.endedAt && !expired;
              return (
                <TableRow key={s.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(s.startedAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.superAdminUserId}</TableCell>
                  <TableCell className="font-mono text-xs">{s.targetUserId}</TableCell>
                  <TableCell className="font-mono text-xs">{s.organizationId}</TableCell>
                  <TableCell>
                    {active ? (
                      <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
                        Active
                      </Badge>
                    ) : s.endedAt ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        Ended ({s.endedReason ?? 'manual'})
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                        Expired
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {active ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={endMutation.isPending}
                        onClick={() => endMutation.mutate(s.id)}
                      >
                        End now
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
        {!isLoading && items?.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
              No impersonation sessions match the current filters.
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
