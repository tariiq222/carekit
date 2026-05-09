'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@deqah/ui/primitives/badge';
import { Button } from '@deqah/ui/primitives/button';
import { Skeleton } from '@deqah/ui/primitives/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@deqah/ui/primitives/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@deqah/ui/primitives/table';
import type { VerticalRow } from '../types';

interface Props {
  items: VerticalRow[] | undefined;
  isLoading: boolean;
  selectedId?: string;
  onSelect: (vertical: VerticalRow) => void;
  onEdit: (vertical: VerticalRow) => void;
  onDelete: (vertical: VerticalRow) => void;
}

export function VerticalsTable({ items, isLoading, selectedId, onSelect, onEdit, onDelete }: Props) {
  return (
    <TooltipProvider delayDuration={200}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Slug</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && !items
            ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-5" />
                  </TableCell>
                </TableRow>
              ))
            : items?.map((v) => (
                <TableRow
                  key={v.id}
                  className={`cursor-pointer h-10 ${selectedId === v.id ? 'bg-accent/50' : 'hover:bg-muted/40'}`}
                  onClick={() => onSelect(v)}
                >
                  <TableCell>
                    <span className="font-mono text-[12px]">{v.slug}</span>
                  </TableCell>
                  <TableCell>
                    <div className="text-[13px] font-medium leading-tight">{v.nameEn}</div>
                    <div className="text-[11px] text-muted-foreground">{v.nameAr}</div>
                  </TableCell>
                  <TableCell>
                    {v.isActive ? (
                      <Badge variant="outline" className="border-success/40 bg-success/10 text-success text-[11px]">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-[11px]">
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-9 rounded-sm"
                            onClick={() => onEdit(v)}
                            aria-label={`Edit ${v.slug}`}
                          >
                            <Pencil size={14} strokeWidth={1.75} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-9 rounded-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => onDelete(v)}
                            aria-label={`Delete ${v.slug}`}
                          >
                            <Trash2 size={14} strokeWidth={1.75} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          {!isLoading && items?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                No verticals defined. Create one using the button above.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
