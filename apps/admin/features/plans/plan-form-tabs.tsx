'use client';

import { useState } from 'react';
import { Input } from '@deqah/ui/primitives/input';
import { Label } from '@deqah/ui/primitives/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@deqah/ui/primitives/tabs';
import type { PlanLimits as FlatPlanLimits } from './plan-limits';
import { FEATURE_FIELDS, OVERAGE_FIELDS, QUOTA_FIELDS } from './plan-limits';
import { FeaturesTab } from './features-tab/features-tab';
import type { PlanLimits as FeatureLimits } from './features-tab/presets';
import type { FeatureKey } from '@deqah/shared';

interface Props {
  general: React.ReactNode;
  limits: FlatPlanLimits;
  onLimitsChange: (next: FlatPlanLimits) => void;
  idPrefix: string;
}

/** Extract boolean feature flags from the flat limits into the new {features, quotas} shape. */
function toFeatureLimits(flat: FlatPlanLimits): FeatureLimits {
  const features: Partial<Record<FeatureKey, boolean>> = {};
  for (const f of FEATURE_FIELDS) {
    features[f.key as FeatureKey] = flat[f.key] as boolean;
  }
  return { features, quotas: {} };
}

/** Merge updated feature booleans back into the flat limits. */
function mergeFeatureLimits(flat: FlatPlanLimits, next: FeatureLimits): FlatPlanLimits {
  const updated = { ...flat };
  for (const [key, value] of Object.entries(next.features)) {
    if (key in updated) {
      (updated as Record<string, unknown>)[key] = value;
    }
  }
  return updated;
}

export function PlanFormTabs({ general, limits, onLimitsChange, idPrefix }: Props) {
  const [activeTab, setActiveTab] = useState('general');

  const setNumber = (key: keyof FlatPlanLimits) => (value: string) => {
    const parsed = value === '' || value === '-' ? 0 : Number(value);
    if (Number.isNaN(parsed)) return;
    onLimitsChange({ ...limits, [key]: parsed });
  };

  const handleFeaturesChange = (next: FeatureLimits) => {
    onLimitsChange(mergeFeatureLimits(limits, next));
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-col w-full">
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="quotas">Quotas</TabsTrigger>
        <TabsTrigger value="features">Features</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="mt-4 space-y-4">
        {general}
      </TabsContent>

      <TabsContent value="quotas" className="mt-4 space-y-5">
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Hard limits</p>
          <div className="grid grid-cols-2 gap-3">
            {QUOTA_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-${f.key}`}>{f.label}</Label>
                <Input
                  id={`${idPrefix}-${f.key}`}
                  type="number"
                  value={String(limits[f.key])}
                  onChange={(e) => setNumber(f.key)(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{f.hint}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
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
                  value={String(limits[f.key])}
                  onChange={(e) => setNumber(f.key)(e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="features" className="mt-4">
        <FeaturesTab
          limits={toFeatureLimits(limits)}
          onLimitsChange={handleFeaturesChange}
          onJumpToQuotas={() => setActiveTab('quotas')}
        />
      </TabsContent>
    </Tabs>
  );
}
