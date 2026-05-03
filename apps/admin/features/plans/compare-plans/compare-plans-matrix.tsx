'use client';

import { Check } from 'lucide-react';
import { Badge } from '@deqah/ui/primitives/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@deqah/ui/primitives/table';
import { FEATURE_CATALOG } from '@deqah/shared';
import type { PlanRow } from '../types';
import { QUANT_FIELD_MAP, hydrateLimits, type PlanLimits } from '../plan-limits';

interface Props {
  plans: PlanRow[];
}

const GROUP_ORDER: Array<{ id: string; label: string }> = [
  { id: 'Booking & Scheduling', label: 'Booking & Scheduling' },
  { id: 'Client Engagement', label: 'Client Engagement' },
  { id: 'Finance & Compliance', label: 'Finance & Compliance' },
  { id: 'Operations', label: 'Operations' },
  { id: 'Platform', label: 'Platform' },
];

function CellValue({
  catalogKey,
  entry,
  limits,
}: {
  catalogKey: string;
  entry: (typeof FEATURE_CATALOG)[keyof typeof FEATURE_CATALOG];
  limits: PlanLimits;
}) {
  if (entry.kind === 'boolean') {
    const val = limits[catalogKey as keyof PlanLimits];
    if (val === true) {
      return <Check className="size-4 text-success mx-auto" />;
    }
    return <span className="text-muted-foreground">—</span>;
  }

  // quantitative
  const fieldName = QUANT_FIELD_MAP[catalogKey as keyof typeof QUANT_FIELD_MAP];
  if (!fieldName) {
    return <span className="text-muted-foreground">—</span>;
  }
  const raw = limits[fieldName as keyof PlanLimits];
  const value = typeof raw === 'number' ? raw : 0;

  if (value === -1) {
    return <span className="font-mono font-semibold tabular-nums text-sm">∞</span>;
  }
  if (value === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="font-mono tabular-nums text-sm">{value.toLocaleString()}</span>
  );
}

export function ComparePlansMatrix({ plans }: Props) {
  const sorted = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);

  const grouped: Record<string, Array<[string, (typeof FEATURE_CATALOG)[keyof typeof FEATURE_CATALOG]]>> = {};
  for (const g of GROUP_ORDER) grouped[g.id] = [];

  for (const [key, entry] of Object.entries(FEATURE_CATALOG)) {
    (grouped[entry.group] ??= []).push([key, entry]);
  }

  const hydratedPlans = sorted.map((plan) => ({
    plan,
    limits: hydrateLimits(plan.limits),
  }));

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 top-0 z-20 bg-card min-w-[220px]">
              Feature
            </TableHead>
            {hydratedPlans.map(({ plan }) => {
              const subs = plan._count.subscriptions;
              return (
                <TableHead
                  key={plan.id}
                  className="sticky top-0 z-10 bg-card text-center min-w-[120px]"
                >
                  <div className="flex flex-col items-center gap-1">
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
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {GROUP_ORDER.map((g) => {
            const entries = grouped[g.id] ?? [];
            if (entries.length === 0) return null;
            return (
              <>
                <TableRow key={`group-${g.id}`}>
                  <TableCell
                    colSpan={sorted.length + 1}
                    className="bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground py-2 px-3"
                  >
                    {g.label}
                  </TableCell>
                </TableRow>
                {entries.map(([catalogKey, entry]) => (
                  <TableRow key={catalogKey}>
                    <TableCell className="sticky left-0 z-10 bg-card">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{entry.nameEn}</span>
                          <Badge
                            variant={entry.tier === 'ENTERPRISE' ? 'default' : 'secondary'}
                            className={
                              entry.tier === 'ENTERPRISE' ? 'bg-primary/15 text-primary' : undefined
                            }
                          >
                            {entry.tier}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {entry.descEn}
                        </p>
                      </div>
                    </TableCell>
                    {hydratedPlans.map(({ plan, limits }) => (
                      <TableCell key={plan.id} className="text-center">
                        <CellValue catalogKey={catalogKey} entry={entry} limits={limits} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
