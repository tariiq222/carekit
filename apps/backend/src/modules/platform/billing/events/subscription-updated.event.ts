/**
 * Emitted after any subscription state transition.
 * Consumers (e.g. CacheInvalidatorListener) use this to flush caches.
 */
export interface SubscriptionUpdatedPayload {
  organizationId: string;
  subscriptionId: string;
  reason: 'UPGRADE' | 'DOWNGRADE' | 'START' | 'CANCEL' | 'REACTIVATE';
}

export const SUBSCRIPTION_UPDATED_EVENT = 'billing.subscription.updated';
