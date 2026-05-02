'use client';
import { useState } from 'react';
import type { FeatureKey } from '@deqah/shared';
import { FeatureRow } from './feature-row';
import type { CatalogEntry } from './filter';
import type { PlanLimits } from './presets';

type Props = {
  groupLabel: string;
  entries: Array<[FeatureKey, CatalogEntry]>;
  limits: PlanLimits;
  onToggle: (key: FeatureKey, next: boolean) => void;
  onJumpToQuotas: () => void;
};

export function FeatureGroupSection({ groupLabel, entries, limits, onToggle, onJumpToQuotas }: Props) {
  const [open, setOpen] = useState(true);
  const total = entries.length;
  const enabled = entries.filter(([k]) => limits.features[k] === true).length;

  if (total === 0) return null;

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded-lg border border-border bg-card"
    >
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold">{groupLabel}</span>
        <span className="text-xs text-muted-foreground">{enabled} enabled / {total} total</span>
      </summary>
      <div className="px-4 pb-2">
        {entries.map(([key, entry]) => (
          <FeatureRow
            key={key}
            featureKey={key}
            entry={entry}
            enabled={limits.features[key] === true}
            quota={limits.quotas[key]}
            onToggle={(v) => onToggle(key, v)}
            onJumpToQuotas={onJumpToQuotas}
          />
        ))}
      </div>
    </details>
  );
}
