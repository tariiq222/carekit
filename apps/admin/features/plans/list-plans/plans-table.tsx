'use client';

import { Badge } from '@carekit/ui/primitives/badge';
import { Skeleton } from '@carekit/ui/primitives/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carekit/ui/primitives/table';
import type { PlanRow } from '../types';

interface Props {
  items: PlanRow[] | undefined;
  isLoading: boolean;
}

export function PlansTable({ items, isLoading }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Slug</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Monthly</TableHead>
          <TableHead className="text-right">Annual</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading && !items
          ? Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={5}>
                  <Skeleton className="h-6" />
                </TableCell>
              </TableRow>
            ))
          : items?.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className="font-mono text-xs">{plan.slug}</TableCell>
                <TableCell>
                  <div className="font-medium">{plan.nameAr}</div>
                  <div className="text-xs text-muted-foreground">{plan.nameEn}</div>
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
              </TableRow>
            ))}
        {!isLoading && items?.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
              No plans defined. Create one via the API.
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
