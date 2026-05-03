'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@deqah/ui/primitives/tabs';
import type { PlanLimits } from './plan-limits';
import { FeaturesTab } from './features-tab/features-tab';

interface Props {
  general: React.ReactNode;
  limits: PlanLimits;
  onLimitsChange: (next: PlanLimits) => void;
  idPrefix: string;
}

export function PlanFormTabs({ general, limits, onLimitsChange, idPrefix }: Props) {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-col w-full">
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="features">Features &amp; Limits</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="mt-4 space-y-4">
        {general}
      </TabsContent>

      <TabsContent value="features" className="mt-4">
        <FeaturesTab
          flatLimits={limits}
          onFlatLimitsChange={onLimitsChange}
          idPrefix={idPrefix}
        />
      </TabsContent>
    </Tabs>
  );
}
