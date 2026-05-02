'use client';
import { FEATURE_CATALOG, type FeatureGroup } from '@deqah/shared';
import type { FeatureKey } from '@deqah/shared';
import { Badge } from '@deqah/ui/primitives/badge';
import { Button } from '@deqah/ui/primitives/button';
import { OverrideCell } from './override-cell';
import { usePendingOverrides } from './use-pending-overrides';
import type { OverrideMode } from './upsert-override.api';

interface Props {
  organizationId: string;
  planDefaults: Partial<Record<FeatureKey, boolean>>;
  currentOverrides: Partial<Record<FeatureKey, boolean>>;
  onSave: (changes: Array<{ key: FeatureKey; mode: OverrideMode }>) => void;
  saving?: boolean;
}

const GROUP_ORDER: FeatureGroup[] = [
  'Booking & Scheduling',
  'Client Engagement',
  'Finance & Compliance',
  'Operations',
  'Platform',
];

function initialMode(orgOverride: boolean | undefined): OverrideMode {
  if (orgOverride === undefined) return 'INHERIT';
  return orgOverride ? 'FORCE_ON' : 'FORCE_OFF';
}

function effective(mode: OverrideMode, planDefault: boolean): boolean {
  if (mode === 'FORCE_ON') return true;
  if (mode === 'FORCE_OFF') return false;
  return planDefault;
}

export function EntitlementsTable({ organizationId, planDefaults, currentOverrides, onSave, saving }: Props) {
  const initialMap: Partial<Record<FeatureKey, OverrideMode>> = {};
  for (const k of Object.keys(currentOverrides) as FeatureKey[]) {
    if (currentOverrides[k] !== undefined) {
      initialMap[k] = currentOverrides[k] ? 'FORCE_ON' : 'FORCE_OFF';
    }
  }

  const { pending, setMode, dirtyCount } = usePendingOverrides(initialMap);

  const grouped = new Map<FeatureGroup, FeatureKey[]>();
  for (const group of GROUP_ORDER) grouped.set(group, []);
  for (const [key, entry] of Object.entries(FEATURE_CATALOG)) {
    grouped.get(entry.group)?.push(key as FeatureKey);
  }

  const handleSave = () => {
    const changes: Array<{ key: FeatureKey; mode: OverrideMode }> = [];
    for (const [key, init] of Object.entries(initialMap) as Array<[FeatureKey, OverrideMode]>) {
      const cur = pending[key] ?? 'INHERIT';
      if (cur !== init) changes.push({ key, mode: cur });
    }
    for (const [key, mode] of Object.entries(pending) as Array<[FeatureKey, OverrideMode]>) {
      if (!(key in initialMap)) changes.push({ key, mode });
    }
    onSave(changes);
  };

  return (
    <div className="space-y-6" data-testid="entitlements-table">
      {GROUP_ORDER.map((group) => {
        const keys = grouped.get(group) ?? [];
        if (keys.length === 0) return null;
        return (
          <section key={group} className="space-y-2">
            <h3 className="text-sm font-semibold">{group}</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2">Feature</th>
                  <th className="py-2">Tier</th>
                  <th className="py-2">Plan default</th>
                  <th className="py-2">Org override</th>
                  <th className="py-2">Effective</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => {
                  const entry = FEATURE_CATALOG[k];
                  const planDefault = planDefaults[k] ?? false;
                  const init = initialMode(currentOverrides[k]);
                  const mode = pending[k] ?? init;
                  const eff = effective(mode, planDefault);
                  return (
                    <tr key={k} className="border-b">
                      <td className="py-2">{entry.nameEn}</td>
                      <td className="py-2"><Badge variant={entry.tier === 'PRO' ? 'secondary' : 'default'}>{entry.tier}</Badge></td>
                      <td className="py-2">{planDefault ? '✓' : '—'}</td>
                      <td className="py-2"><OverrideCell value={mode} initial={init} onChange={(m) => setMode(k, m)} disabled={saving} /></td>
                      <td className="py-2">{eff ? '✓' : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}

      <div className="flex justify-end items-center gap-3 pt-4 border-t">
        <span className="text-sm text-muted-foreground">{dirtyCount} change{dirtyCount === 1 ? '' : 's'}</span>
        <Button onClick={handleSave} disabled={dirtyCount === 0 || saving}>
          Save {dirtyCount} change{dirtyCount === 1 ? '' : 's'}
        </Button>
      </div>
    </div>
  );
}
