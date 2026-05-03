'use client';
import { useMemo, useState } from 'react';
import { type FeatureKey } from '@deqah/shared';
import { Input } from '@deqah/ui/primitives/input';
import { Label } from '@deqah/ui/primitives/label';
import { FeatureSearch } from './feature-search';
import { PresetButtons } from './preset-buttons';
import { FeatureGroupSection } from './feature-group-section';
import { filterCatalog } from './filter';
import type { PlanLimits } from '../plan-limits';
import { OVERAGE_FIELDS } from '../plan-limits';

const GROUP_ORDER: Array<{ id: string; label: string }> = [
  { id: 'Booking & Scheduling', label: 'Booking & Scheduling' },
  { id: 'Client Engagement', label: 'Client Engagement' },
  { id: 'Finance & Compliance', label: 'Finance & Compliance' },
  { id: 'Operations', label: 'Operations' },
  { id: 'Platform', label: 'Platform' },
];

type Props = {
  flatLimits: PlanLimits;
  onFlatLimitsChange: (next: PlanLimits) => void;
  idPrefix: string;
};

function parseInputNumber(s: string): number {
  if (s === '' || s === '-') return 0;
  const n = Number(s);
  return Number.isNaN(n) ? 0 : n;
}

export function FeaturesTab({ flatLimits, onFlatLimitsChange, idPrefix }: Props) {
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const filtered = filterCatalog(query);
    const buckets: Record<string, typeof filtered> = {};
    for (const g of GROUP_ORDER) buckets[g.id] = [];
    for (const row of filtered) {
      const [, entry] = row;
      (buckets[entry.group] ??= []).push(row);
    }
    return buckets;
  }, [query]);

  const handleToggle = (key: FeatureKey, next: boolean) => {
    onFlatLimitsChange({ ...flatLimits, [key]: next });
  };

  const handleNumber = (key: keyof PlanLimits, value: number) => {
    onFlatLimitsChange({ ...flatLimits, [key]: value });
  };

  return (
    <div className="space-y-4">
      <PresetButtons limits={flatLimits} onLimitsChange={onFlatLimitsChange} />
      <FeatureSearch value={query} onChange={setQuery} />
      <div className="space-y-3">
        {GROUP_ORDER.map((g) => (
          <FeatureGroupSection
            key={g.id}
            groupLabel={g.label}
            entries={grouped[g.id] ?? []}
            limits={flatLimits}
            onToggle={handleToggle}
            onNumberChange={handleNumber}
            idPrefix={idPrefix}
          />
        ))}
      </div>

      <div className="space-y-3 pt-2">
        <p className="text-sm font-medium text-foreground">Overage pricing</p>
        <div className="grid grid-cols-3 gap-3">
          {OVERAGE_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-${f.key}`}>{f.label}</Label>
              <Input
                id={`${idPrefix}-${f.key}`}
                type="number"
                min={0}
                step="0.01"
                value={String(flatLimits[f.key])}
                onChange={(e) => handleNumber(f.key, parseInputNumber(e.target.value))}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
