'use client';
import { Badge } from '@deqah/ui/primitives/badge';
import { Input } from '@deqah/ui/primitives/input';
import { Switch } from '@deqah/ui/primitives/switch';
import type { FeatureKey } from '@deqah/shared';
import type { CatalogEntry } from './filter';

function parseInputNumber(s: string): number {
  if (s === '' || s === '-') return 0;
  const n = Number(s);
  return Number.isNaN(n) ? 0 : n;
}

type Props = {
  featureKey: FeatureKey;
  entry: CatalogEntry;
  idPrefix: string;
  // boolean entries
  enabled?: boolean;
  onToggle?: (next: boolean) => void;
  // quantitative entries
  kind: 'boolean' | 'quantitative';
  quotaValue?: number;
  onQuotaChange?: (next: number) => void;
  quotaHint?: string;
};

export function FeatureRow({
  featureKey,
  entry,
  idPrefix,
  enabled,
  onToggle,
  kind,
  quotaValue,
  onQuotaChange,
  quotaHint,
}: Props) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border/50 last:border-b-0">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{entry.nameEn}</span>
          <Badge
            variant={entry.tier === 'ENTERPRISE' ? 'default' : 'secondary'}
            className={entry.tier === 'ENTERPRISE' ? 'bg-primary/15 text-primary' : undefined}
          >
            {entry.tier}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{entry.descEn}</p>
      </div>
      {kind === 'quantitative' ? (
        <div className="flex items-center gap-2">
          <Input
            id={`${idPrefix}-${featureKey}`}
            type="number"
            className="w-28 text-right"
            value={String(quotaValue ?? 0)}
            onChange={(e) => onQuotaChange?.(parseInputNumber(e.target.value))}
          />
          {quotaHint ? (
            <span className="text-xs text-muted-foreground whitespace-nowrap">{quotaHint}</span>
          ) : null}
        </div>
      ) : (
        <Switch
          checked={enabled ?? false}
          onCheckedChange={onToggle}
          aria-label={entry.nameEn}
        />
      )}
    </div>
  );
}
