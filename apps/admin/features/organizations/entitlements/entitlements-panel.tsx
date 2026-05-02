'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@deqah/ui/primitives/card';
import { Skeleton } from '@deqah/ui/primitives/skeleton';
import { toast } from 'sonner';
import type { FeatureKey } from '@deqah/shared';
import { EntitlementsTable } from './entitlements-table';
import { SaveOverridesDialog } from './save-overrides-dialog';
import { useEntitlements } from './use-entitlements';
import { useUpsertOverride } from './use-upsert-override';
import type { OverrideMode } from './upsert-override.api';

interface Props {
  organizationId: string;
}

export function EntitlementsPanel({ organizationId }: Props) {
  const { data, isLoading } = useEntitlements(organizationId);
  const { mutateAsync, isPending } = useUpsertOverride();
  const [pending, setPending] = useState<Array<{ key: FeatureKey; mode: OverrideMode }>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Derive planDefaults from entitlement rows
  const planDefaults: Partial<Record<FeatureKey, boolean>> = {};
  for (const row of data ?? []) {
    planDefaults[row.key as FeatureKey] = row.planDerivedEnabled;
  }

  // Derive currentOverrides from entitlement rows (skip null = INHERIT)
  const currentOverrides: Partial<Record<FeatureKey, boolean>> = {};
  for (const row of data ?? []) {
    if (row.overrideEnabled !== null) {
      currentOverrides[row.key as FeatureKey] = row.overrideEnabled;
    }
  }

  const handleSave = (changes: Array<{ key: FeatureKey; mode: OverrideMode }>) => {
    setPending(changes);
    setDialogOpen(true);
  };

  const handleConfirm = async (reason: string) => {
    try {
      for (const change of pending) {
        await mutateAsync({ organizationId, key: change.key, mode: change.mode, reason });
      }
      toast.success(`${pending.length} override${pending.length === 1 ? '' : 's'} saved`);
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save overrides');
      throw err; // re-throw so dialog stays open
    }
  };

  return (
    <section id="entitlements">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entitlements & Feature Overrides</CardTitle>
          <p className="text-sm text-muted-foreground">
            Override plan defaults for this organization. Changes take effect immediately.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : (
            <EntitlementsTable
              organizationId={organizationId}
              planDefaults={planDefaults}
              currentOverrides={currentOverrides}
              onSave={handleSave}
              saving={isPending}
            />
          )}
        </CardContent>
      </Card>

      <SaveOverridesDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        changes={pending}
        onConfirm={handleConfirm}
      />
    </section>
  );
}
