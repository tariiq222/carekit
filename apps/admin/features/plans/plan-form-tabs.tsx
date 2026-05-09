'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@deqah/ui/primitives/tabs';
import { useListPlans } from './list-plans/use-list-plans';
import { ComparePlansMatrix } from './compare-plans/compare-plans-matrix';
import { FeaturesTab } from './features-tab/features-tab';
import type { PlanLimits } from './plan-limits';

interface Props {
  general: React.ReactNode;
  features?: React.ReactNode;
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
  flatLimits?: PlanLimits;
  onFlatLimitsChange?: (next: PlanLimits) => void;
  idPrefix?: string;
}

export function PlanFormTabs({
  general,
  features,
  activeTab,
  onActiveTabChange,
  flatLimits,
  onFlatLimitsChange,
  idPrefix = 'ft',
}: Props) {
  const { data, isLoading } = useListPlans();

  return (
    <Tabs value={activeTab} onValueChange={onActiveTabChange} className="flex-col w-full">
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        {features && <TabsTrigger value="features">Features</TabsTrigger>}
        <TabsTrigger value="all-plans">Compare & Edit Plans</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="mt-4 space-y-4">
        {general}
      </TabsContent>

      {features && (
        <TabsContent value="features" className="mt-4">
          {flatLimits && onFlatLimitsChange ? (
            <FeaturesTab
              flatLimits={flatLimits}
              onFlatLimitsChange={onFlatLimitsChange}
              idPrefix={idPrefix}
            />
          ) : (
            features
          )}
        </TabsContent>
      )}

      <TabsContent value="all-plans" className="mt-4">
        {isLoading ? (
          <div className="h-40 animate-pulse rounded bg-muted" />
        ) : (
          <ComparePlansMatrix plans={data ?? []} />
        )}
      </TabsContent>
    </Tabs>
  );
}
