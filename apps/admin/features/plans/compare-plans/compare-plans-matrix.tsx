'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Badge } from '@deqah/ui/primitives/badge';
import { Button } from '@deqah/ui/primitives/button';
import { Input } from '@deqah/ui/primitives/input';
import { Switch } from '@deqah/ui/primitives/switch';
import { Label } from '@deqah/ui/primitives/label';
import { Textarea } from '@deqah/ui/primitives/textarea';
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
import { useBatchUpdatePlans } from '../update-plan/use-batch-update-plans';

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

function parseInputNumber(s: string): number {
  if (s === '' || s === '-') return 0;
  const n = Number(s);
  return Number.isNaN(n) ? 0 : n;
}

function initLimits(plans: PlanRow[]): Record<string, PlanLimits> {
  const out: Record<string, PlanLimits> = {};
  for (const plan of plans) {
    out[plan.id] = hydrateLimits(plan.limits);
  }
  return out;
}

export function ComparePlansMatrix({ plans }: Props) {
  const sorted = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);

  const [currentLimits, setCurrentLimits] = useState<Record<string, PlanLimits>>(() =>
    initLimits(sorted),
  );
  const [originalLimits, setOriginalLimits] = useState<Record<string, PlanLimits>>(() =>
    initLimits(sorted),
  );
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const { batchUpdate } = useBatchUpdatePlans();

  const grouped: Record<
    string,
    Array<[string, (typeof FEATURE_CATALOG)[keyof typeof FEATURE_CATALOG]]>
  > = {};
  for (const g of GROUP_ORDER) grouped[g.id] = [];
  for (const [key, entry] of Object.entries(FEATURE_CATALOG)) {
    (grouped[entry.group] ??= []).push([key, entry]);
  }

  const setLimit = useCallback(
    (planId: string, key: string, value: boolean | number) => {
      setCurrentLimits((prev) => ({
        ...prev,
        [planId]: {
          ...prev[planId],
          [key]: value,
        },
      }));
    },
    [],
  );

  const isPlanDirty = useCallback(
    (planId: string): boolean => {
      const cur = currentLimits[planId];
      const orig = originalLimits[planId];
      if (!cur || !orig) return false;
      for (const k of Object.keys(orig) as Array<keyof PlanLimits>) {
        if (cur[k] !== orig[k]) return true;
      }
      return false;
    },
    [currentLimits, originalLimits],
  );

  const dirtyPlanIds = sorted.filter((p) => isPlanDirty(p.id)).map((p) => p.id);
  const dirtyCount = dirtyPlanIds.length;

  const handleCancel = () => {
    if (dirtyCount > 0) {
      if (!window.confirm('Discard all unsaved changes?')) return;
    }
    setCurrentLimits(initLimits(sorted));
    setReason('');
  };

  const handleSave = async () => {
    if (dirtyCount === 0 || reason.trim().length < 10 || isSaving) return;

    const dirtyPlans = sorted.filter((p) => dirtyPlanIds.includes(p.id));
    const plansWithSubscribers = dirtyPlans.filter((p) => p._count.subscriptions > 0);

    if (plansWithSubscribers.length > 0) {
      const ok = window.confirm(
        `You're updating ${dirtyCount} plan${dirtyCount === 1 ? '' : 's'}. ` +
          `${plansWithSubscribers.length} of them have active subscribers. Continue?`,
      );
      if (!ok) return;
    }

    setIsSaving(true);
    try {
      const items = dirtyPlans.map((plan) => ({
        plan,
        limits: currentLimits[plan.id],
        reason,
      }));

      const { succeeded, failed } = await batchUpdate(items);

      if (failed.length === 0) {
        toast.success(`Saved ${succeeded.length} plan${succeeded.length === 1 ? '' : 's'}`);
        // Reset originals for all succeeded plans to current state
        setOriginalLimits((prev) => {
          const next = { ...prev };
          for (const planId of succeeded) {
            next[planId] = { ...currentLimits[planId] };
          }
          return next;
        });
        setReason('');
      } else {
        toast.error(
          `${failed.length} of ${dirtyCount} plan${dirtyCount === 1 ? '' : 's'} failed: ${failed.map((f) => f.planId).join(', ')}`,
        );
        // Reset only succeeded plans' originals
        if (succeeded.length > 0) {
          setOriginalLimits((prev) => {
            const next = { ...prev };
            for (const planId of succeeded) {
              next[planId] = { ...currentLimits[planId] };
            }
            return next;
          });
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const saveDisabled = dirtyCount === 0 || reason.trim().length < 10 || isSaving;

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 top-0 z-20 bg-card min-w-[220px]">
                Feature
              </TableHead>
              {sorted.map((plan) => {
                const subs = plan._count.subscriptions;
                const dirty = isPlanDirty(plan.id);
                return (
                  <TableHead
                    key={plan.id}
                    className="sticky top-0 z-10 bg-card text-center min-w-[140px]"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">{plan.slug}</span>
                        {dirty ? (
                          <span
                            className="inline-block size-1.5 rounded-full bg-amber-500"
                            aria-label="unsaved changes"
                          />
                        ) : null}
                      </div>
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
                          <span className="text-sm font-medium">{entry.nameEn}</span>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {entry.descEn}
                          </p>
                        </div>
                      </TableCell>
                      {sorted.map((plan) => {
                        const limits = currentLimits[plan.id];
                        if (!limits) return <TableCell key={plan.id} />;

                        if (entry.kind === 'boolean') {
                          const val = limits[catalogKey as keyof PlanLimits];
                          return (
                            <TableCell key={plan.id} className="text-center">
                              <div className="flex justify-center">
                                <Switch
                                  checked={val === true}
                                  onCheckedChange={(v) => setLimit(plan.id, catalogKey, v)}
                                  aria-label={`${entry.nameEn} for ${plan.slug}`}
                                />
                              </div>
                            </TableCell>
                          );
                        }

                        // quantitative
                        const fieldName =
                          QUANT_FIELD_MAP[catalogKey as keyof typeof QUANT_FIELD_MAP];
                        if (!fieldName) {
                          return (
                            <TableCell key={plan.id} className="text-center">
                              <span className="text-muted-foreground">—</span>
                            </TableCell>
                          );
                        }
                        const raw = limits[fieldName as keyof PlanLimits];
                        const numVal = typeof raw === 'number' ? raw : 0;

                        return (
                          <TableCell key={plan.id} className="text-center">
                            <Input
                              type="number"
                              className="w-20 text-right tabular-nums mx-auto"
                              value={String(numVal)}
                              onChange={(e) =>
                                setLimit(plan.id, fieldName, parseInputNumber(e.target.value))
                              }
                              aria-label={`${entry.nameEn} for ${plan.slug}`}
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 z-30 -mx-6 border-t border-border bg-background px-6 py-4 mt-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 space-y-2">
            {dirtyCount === 0 ? (
              <p className="text-sm text-muted-foreground">
                No pending changes — edit any cell to enable saving.
              </p>
            ) : (
              <p className="text-sm">
                <span className="font-medium">
                  {dirtyCount} plan{dirtyCount === 1 ? '' : 's'} pending
                </span>
                {reason.trim().length < 10 ? (
                  <span className="text-muted-foreground">
                    {' '}— add a reason (min 10 chars) below to save
                  </span>
                ) : null}
              </p>
            )}
            <div className="space-y-1">
              <Label htmlFor="cmp-reason">Reason (min 10 chars)</Label>
              <Textarea
                id="cmp-reason"
                rows={2}
                placeholder="Reason for these plan updates…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="max-w-lg"
              />
            </div>
          </div>
          <div className="flex items-end gap-2 pt-7">
            <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={saveDisabled}
              title={
                saveDisabled && !isSaving
                  ? 'Add a reason (min 10 chars) below to enable saving.'
                  : undefined
              }
            >
              {isSaving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
