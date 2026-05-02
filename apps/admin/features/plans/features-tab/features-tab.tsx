'use client';
import { useMemo, useState } from 'react';
import { type FeatureKey } from '@deqah/shared';
import { FeatureSearch } from './feature-search';
import { PresetButtons } from './preset-buttons';
import { FeatureGroupSection } from './feature-group-section';
import { filterCatalog } from './filter';
import type { PlanLimits } from './presets';

const GROUP_ORDER: Array<{ id: string; label: string }> = [
  { id: 'Booking & Scheduling', label: 'Booking & Scheduling' },
  { id: 'Client Engagement', label: 'Client Engagement' },
  { id: 'Finance & Compliance', label: 'Finance & Compliance' },
  { id: 'Operations', label: 'Operations' },
  { id: 'Platform', label: 'Platform' },
];

type Props = {
  limits: PlanLimits;
  onLimitsChange: (next: PlanLimits) => void;
  onJumpToQuotas: () => void;
};

export function FeaturesTab({ limits, onLimitsChange, onJumpToQuotas }: Props) {
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const filtered = filterCatalog(query);
    const buckets: Record<string, typeof filtered> = {};
    for (const g of GROUP_ORDER) buckets[g.id] = [];
    for (const row of filtered) {
      const [, entry] = row;
      if (entry.kind !== 'boolean') continue;
      (buckets[entry.group] ??= []).push(row);
    }
    return buckets;
  }, [query]);

  const handleToggle = (key: FeatureKey, next: boolean) => {
    onLimitsChange({
      ...limits,
      features: { ...limits.features, [key]: next },
    });
  };

  return (
    <div className="space-y-4">
      <PresetButtons limits={limits} onLimitsChange={onLimitsChange} />
      <FeatureSearch value={query} onChange={setQuery} />
      <div className="space-y-3">
        {GROUP_ORDER.map((g) => (
          <FeatureGroupSection
            key={g.id}
            groupLabel={g.label}
            entries={grouped[g.id] ?? []}
            limits={limits}
            onToggle={handleToggle}
            onJumpToQuotas={onJumpToQuotas}
          />
        ))}
      </div>
    </div>
  );
}
