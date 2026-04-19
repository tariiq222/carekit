import { apiRequest } from '../client.js';
import { guestApiRequest } from './guest-client.js';
import type { SubscriptionPlan, ClientSubscription } from '../types/subscription.js';

export interface PurchaseSubscriptionPayload {
  planId: string;
  branchId: string;
  successUrl: string;
  failUrl: string;
}

export interface PurchaseSubscriptionResponse {
  subscriptionId: string;
  paymentUrl: string;
  invoiceId: string;
}

export async function getPublicSubscriptions(
  branchId?: string,
): Promise<SubscriptionPlan[]> {
  const query = branchId ? `?branchId=${branchId}` : '';
  return apiRequest<SubscriptionPlan[]>(`/public/subscriptions${query}`);
}

export async function purchaseSubscription(
  payload: PurchaseSubscriptionPayload,
): Promise<PurchaseSubscriptionResponse> {
  return guestApiRequest<PurchaseSubscriptionResponse>(
    '/public/subscriptions/purchase',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function getMySubscriptions(): Promise<ClientSubscription[]> {
  return apiRequest<ClientSubscription[]>('/public/subscriptions/my');
}