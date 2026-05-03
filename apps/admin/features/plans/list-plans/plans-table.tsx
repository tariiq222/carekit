'use client';

import { Badge } from '@deqah/ui/primitives/badge';
import { Button } from '@deqah/ui/primitives/button';
import { Skeleton } from '@deqah/ui/primitives/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@deqah/ui/primitives/table';
import Link from 'next/link';
import type { PlanRow } from '../types';

interface Props {
  items: PlanRow[] | undefined;
  isLoading: boolean;
  onDelete: (plan: PlanRow) => void;
}

export function PlansTable({ items, isLoading, onDelete }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Slug</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Subscribers</TableHead>
          <TableHead className="text-right">Monthly</TableHead>
          <TableHead className="text-right">Annual</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-24">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading && !items
          ? Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={7}>
                  <Skeleton className="h-6" />
                </TableCell>
              </TableRow>
            ))
          : items?.map((plan) => {
              const subs = plan._count.subscriptions;
              return (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{plan.slug}</span>
                      {subs > 0 ? (
                        <Badge
                          variant="outline"
                          className="border-primary/30 bg-primary/10 px-1.5 py-0 font-mono text-[10px] tabular-nums text-primary"
                          title={`${subs} active subscriber${subs === 1 ? '' : 's'}`}
                        >
                          {subs}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{plan.nameAr}</div>
                    <div className="text-xs text-muted-foreground">{plan.nameEn}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {subs === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      subs.toLocaleString()
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {Number(plan.priceMonthly).toLocaleString()} {plan.currency}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {Number(plan.priceAnnual).toLocaleString()} {plan.currency}
                  </TableCell>
                  <TableCell>
                    {plan.isActive ? (
                      <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/plans/${plan.id}/edit`}>Edit</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => onDelete(plan)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
        {!isLoading && items?.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
              No plans defined. Create one using the button above.
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
