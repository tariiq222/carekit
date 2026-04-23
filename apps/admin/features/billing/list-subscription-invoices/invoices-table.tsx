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
import type { SubscriptionInvoiceRow, SubscriptionInvoiceStatus } from '../types';

const STATUS_TONE: Record<SubscriptionInvoiceStatus, string> = {
  PAID: 'border-success/40 bg-success/10 text-success',
  DUE: 'border-muted bg-muted text-muted-foreground',
  FAILED: 'border-warning/40 bg-warning/10 text-warning',
  VOID: 'border-destructive/40 bg-destructive/10 text-destructive',
  DRAFT: 'border-muted bg-muted text-muted-foreground',
};

interface Props {
  items: SubscriptionInvoiceRow[] | undefined;
  isLoading: boolean;
}

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function InvoicesTable({ items, isLoading }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Organization</TableHead>
          <TableHead>Amount (SAR)</TableHead>
          <TableHead>Refunded</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Period</TableHead>
          <TableHead>Due</TableHead>
          <TableHead className="text-right">Org</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading && !items
          ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={8}>
                  <Skeleton className="h-6" />
                </TableCell>
              </TableRow>
            ))
          : items?.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono text-xs">{inv.id.slice(0, 8)}…</TableCell>
                <TableCell className="font-mono text-xs">
                  {inv.organizationId.slice(0, 8)}…
                </TableCell>
                <TableCell className="font-medium">
                  {Number(inv.amount).toFixed(2)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {inv.refundedAmount ? `−${Number(inv.refundedAmount).toFixed(2)}` : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_TONE[inv.status]}>
                    {inv.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {fmt(inv.periodStart)} → {fmt(inv.periodEnd)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmt(inv.dueDate)}</TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/billing/${inv.organizationId}`}>Open</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
        {!isLoading && items?.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
              No invoices match the current filters.
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
