'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SubscriptionsList } from '@/features/subscriptions/subscriptions-list';
import type { SubscriptionPlan } from '@/features/subscriptions/subscriptions.api';

export default function SubscriptionsPage() {
  const t = useTranslations();
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
  };

  const handlePurchase = () => {
    if (!selectedPlan) return;

    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5100';
    const successUrl = `${window.location.origin}/subscriptions/success`;
    const failUrl = `${window.location.origin}/subscriptions`;

    const loginUrl = `/login?redirect=/subscriptions&planId=${selectedPlan.id}&branchId=&successUrl=${encodeURIComponent(successUrl)}&failUrl=${encodeURIComponent(failUrl)}`;

    router.push(loginUrl);
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Subscription Plans
        </h1>
        <p style={{ opacity: 0.7 }}>
          Choose a subscription plan that works for you
        </p>
      </div>

      <SubscriptionsList
        branchId={undefined}
        onSelectPlan={handleSelectPlan}
        selectedPlanId={selectedPlan?.id}
      />

      {selectedPlan && (
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button
            onClick={handlePurchase}
            style={{
              padding: '1rem 3rem',
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              border: 'none',
              borderRadius: 'var(--radius)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Subscribe to {selectedPlan.nameAr}
          </button>
        </div>
      )}
    </div>
  );
}