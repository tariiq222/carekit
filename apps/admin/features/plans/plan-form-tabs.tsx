'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@deqah/ui/primitives/tabs';
import { useListPlans } from './list-plans/use-list-plans';
import { ComparePlansMatrix } from './compare-plans/compare-plans-matrix';

interface Props {
  general: React.ReactNode;
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
}

export function PlanFormTabs({ general, activeTab, onActiveTabChange }: Props) {
  const { data, isLoading } = useListPlans();

  return (
    <Tabs value={activeTab} onValueChange={onActiveTabChange} className="flex-col w-full">
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="all-plans">Compare & Edit Plans</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="mt-4 space-y-4">
        {general}
      </TabsContent>

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
