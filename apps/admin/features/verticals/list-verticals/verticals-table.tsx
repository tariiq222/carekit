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
import type { VerticalRow } from '../types';

interface Props {
  items: VerticalRow[] | undefined;
  isLoading: boolean;
}

export function VerticalsTable({ items, isLoading }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Slug</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Template family</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading && !items
          ? Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={4}>
                  <Skeleton className="h-6" />
                </TableCell>
              </TableRow>
            ))
          : items?.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-mono text-xs">{v.slug}</TableCell>
                <TableCell>
                  <div className="font-medium">{v.nameAr}</div>
                  <div className="text-xs text-muted-foreground">{v.nameEn}</div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{v.templateFamily}</TableCell>
                <TableCell>
                  {v.isActive ? (
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
            <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
              No verticals defined. Run the verticals seed.
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
