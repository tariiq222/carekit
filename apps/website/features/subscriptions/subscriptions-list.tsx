'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePublicSubscriptions } from './use-public-subscriptions';
import { SubscriptionCard } from './subscription-card';
import type { SubscriptionPlan } from './subscriptions.api';

interface SubscriptionsListProps {
  branchId?: string;
  onSelectPlan?: (plan: SubscriptionPlan) => void;
  selectedPlanId?: string;
}

export function SubscriptionsList({
  branchId,
  onSelectPlan,
  selectedPlanId,
}: SubscriptionsListProps) {
  const { plans, isLoading, error } = usePublicSubscriptions(branchId);

  if (isLoading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl border border-border bg-card p-6"
          >
            <div className="mb-4 h-6 w-24 rounded bg-muted" />
            <div className="mb-4 h-10 w-20 rounded bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-3/4 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error}
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        No subscription plans available.
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => (
        <SubscriptionCard
          key={plan.id}
          plan={plan}
          isSelected={selectedPlanId === plan.id}
          onSelect={onSelectPlan}
        />
      ))}
    </div>
  );
}