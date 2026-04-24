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
import type { OrganizationRow } from '../types';

interface Props {
  items: OrganizationRow[] | undefined;
  isLoading: boolean;
}

export function OrganizationsTable({ items, isLoading }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Slug</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
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
          : items?.map((org) => (
              <TableRow key={org.id}>
                <TableCell className="font-mono text-xs">{org.slug}</TableCell>
                <TableCell>
                  <div className="font-medium">{org.nameAr}</div>
                  {org.nameEn ? (
                    <div className="text-xs text-muted-foreground">{org.nameEn}</div>
                  ) : null}
                </TableCell>
                <TableCell>
                  {org.subscription ? (
                    <span className="font-mono text-xs">{org.subscription.plan.slug}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
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
        {!isLoading && items?.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
              No organizations match the current filters.
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
