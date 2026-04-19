'use client';

import { useState, useEffect } from 'react';
import { getMySubscriptions, type ClientSubscription } from '@/features/subscriptions/subscriptions.api';

export default function AccountSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<ClientSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSubscriptions() {
      try {
        const data = await getMySubscriptions();
        setSubscriptions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load subscriptions');
      } finally {
        setIsLoading(false);
      }
    }

    fetchSubscriptions();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
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

  if (subscriptions.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        You don&apos;t have any subscriptions yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">My Subscriptions</h2>

      <div className="space-y-4">
        {subscriptions.map((sub) => (
          <div
            key={sub.id}
            className="rounded-lg border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{sub.plan.nameAr}</h3>
                <p className="text-sm text-muted-foreground">{sub.plan.nameEn}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  sub.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-800'
                    : sub.status === 'PENDING'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {sub.status}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Started:</span>{' '}
                {sub.startDate
                  ? new Date(sub.startDate).toLocaleDateString('ar-SA')
                  : 'N/A'}
              </div>
              <div>
                <span className="text-muted-foreground">Expires:</span>{' '}
                {sub.endDate
                  ? new Date(sub.endDate).toLocaleDateString('ar-SA')
                  : 'N/A'}
              </div>
              <div>
                <span className="text-muted-foreground">Benefits Used:</span>{' '}
                {sub.benefitsUsed}
                {sub.maxBenefits ? ` / ${sub.maxBenefits}` : ''}
              </div>
              <div>
                <span className="text-muted-foreground">Total Paid:</span>{' '}
                {new Intl.NumberFormat('ar-SA', {
                  style: 'currency',
                  currency: sub.plan.currency,
                }).format(sub.totalPaid)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
