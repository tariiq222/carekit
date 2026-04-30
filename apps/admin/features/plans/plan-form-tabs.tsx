'use client';

import { Input } from '@deqah/ui/primitives/input';
import { Label } from '@deqah/ui/primitives/label';
import { Switch } from '@deqah/ui/primitives/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@deqah/ui/primitives/tabs';
import type { PlanLimits } from './plan-limits';
import { FEATURE_FIELDS, OVERAGE_FIELDS, QUOTA_FIELDS } from './plan-limits';

interface Props {
  general: React.ReactNode;
  limits: PlanLimits;
  onLimitsChange: (next: PlanLimits) => void;
  idPrefix: string;
}

export function PlanFormTabs({ general, limits, onLimitsChange, idPrefix }: Props) {
  const setNumber = (key: keyof PlanLimits) => (value: string) => {
    const parsed = value === '' || value === '-' ? 0 : Number(value);
    if (Number.isNaN(parsed)) return;
    onLimitsChange({ ...limits, [key]: parsed });
  };
  const setBool = (key: keyof PlanLimits) => (value: boolean) => {
    onLimitsChange({ ...limits, [key]: value });
  };

  return (
    <Tabs defaultValue="general" className="flex-col w-full">
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
        <div className="grid grid-cols-2 gap-3">
          {FEATURE_FIELDS.map((f) => (
            <label
              key={f.key}
              htmlFor={`${idPrefix}-${f.key}`}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-card/50 px-3 py-2.5"
            >
              <span className="text-sm text-foreground">{f.label}</span>
              <Switch
                id={`${idPrefix}-${f.key}`}
                checked={limits[f.key] as boolean}
                onCheckedChange={setBool(f.key)}
              />
            </label>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
