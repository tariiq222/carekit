'use client';

import Link from 'next/link';
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
import type { SubscriptionRow, SubscriptionStatus } from '../types';

const STATUS_TONE: Record<SubscriptionStatus, string> = {
  ACTIVE: 'border-success/40 bg-success/10 text-success',
  TRIALING: 'border-info/40 bg-info/10 text-info',
  PAST_DUE: 'border-warning/40 bg-warning/10 text-warning',
  SUSPENDED: 'border-destructive/40 bg-destructive/10 text-destructive',
  CANCELED: 'border-destructive/40 bg-destructive/10 text-destructive',
};

interface Props {
  items: SubscriptionRow[] | undefined;
  isLoading: boolean;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function SubscriptionsTable({ items, isLoading }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Organization</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Cycle</TableHead>
          <TableHead>Period ends</TableHead>
          <TableHead>Last payment</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading && !items
          ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={7}>
                  <Skeleton className="h-6" />
                </TableCell>
              </TableRow>
            ))
          : items?.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.organizationId.slice(0, 8)}…</TableCell>
                <TableCell>
                  <div className="font-medium">{s.plan.nameEn}</div>
                  <div className="text-xs text-muted-foreground">
                    {Number(s.plan.priceMonthly).toFixed(2)} SAR/mo
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_TONE[s.status]}>
                    {s.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.billingCycle}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {fmtDate(s.currentPeriodEnd)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {fmtDate(s.lastPaymentAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/billing/${s.organizationId}`}>Open</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
        {!isLoading && items?.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
              No subscriptions match the current filters.
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
