'use client';
import { Badge } from '@deqah/ui/primitives/badge';
import { Switch } from '@deqah/ui/primitives/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@deqah/ui/primitives/tooltip';
import type { FeatureKey } from '@deqah/shared';
import type { CatalogEntry } from './filter';

const QUOTA_LINKED: Partial<Record<FeatureKey, string>> = {
  multi_branch: 'maxBranches',
  employees: 'maxEmployees',
  services: 'maxServices',
  monthly_bookings: 'maxMonthlyBookings',
  storage: 'maxStorageMb',
} as Partial<Record<FeatureKey, string>>;

type Props = {
  featureKey: FeatureKey;
  entry: CatalogEntry;
  enabled: boolean;
  quota?: number;
  onToggle: (next: boolean) => void;
  onJumpToQuotas: () => void;
};

export function FeatureRow({ featureKey, entry, enabled, quota, onToggle, onJumpToQuotas }: Props) {
  const quotaField = QUOTA_LINKED[featureKey];
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
          {quotaField && quota !== undefined && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onJumpToQuotas}
                  className="rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted/70"
                >
                  Quota: {quota === -1 ? 'unlimited' : quota}
                </button>
              </TooltipTrigger>
              <TooltipContent>Configure in Quotas tab</TooltipContent>
            </Tooltip>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{entry.descEn}</p>
      </div>
      <Switch checked={enabled} onCheckedChange={onToggle} aria-label={entry.nameEn} />
    </div>
  );
}
