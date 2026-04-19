'use client';

import { useState, useEffect } from 'react';
import { getPublicSubscriptions, type SubscriptionPlan } from './subscriptions.api';

export function usePublicSubscriptions(branchId?: string) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPlans() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getPublicSubscriptions(branchId);
        if (!cancelled) {
          setPlans(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load subscriptions');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchPlans();

    return () => {
      cancelled = true;
    };
  }, [branchId]);

  return { plans, isLoading, error };
}