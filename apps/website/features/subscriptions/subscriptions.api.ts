const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5100';

export interface SubscriptionBenefit {
  type: 'DISCOUNT_PERCENT' | 'DISCOUNT_FIXED' | 'SESSION_CREDITS' | 'FREE_SESSIONS';
  value: number;
  serviceIds?: string[];
}

export interface SubscriptionPlan {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  price: number;
  currency: string;
  durationDays: number;
  benefits: SubscriptionBenefit[];
}

export interface ClientSubscription {
  id: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PENDING';
  benefitsUsed: number;
  maxBenefits?: number;
  startDate?: string;
  endDate?: string;
  totalPaid: number;
  createdAt: string;
  plan: SubscriptionPlan;
}

export interface PurchaseSubscriptionResponse {
  subscriptionId: string;
  paymentUrl: string;
  invoiceId: string;
}

export async function getPublicSubscriptions(
  branchId?: string,
): Promise<SubscriptionPlan[]> {
  const url = branchId
    ? `${API_BASE}/public/subscriptions?branchId=${encodeURIComponent(branchId)}`
    : `${API_BASE}/public/subscriptions`;

  const res = await fetch(url, {
    next: { revalidate: 60, tags: ['public-subscriptions'] },
  });
  if (!res.ok) throw new Error(`Failed to fetch subscriptions: ${res.status}`);
  const json = await res.json();
  return (json.data ?? json) as SubscriptionPlan[];
}

export async function purchaseSubscription(
  payload: {
    planId: string;
    branchId: string;
    successUrl: string;
    failUrl: string;
  },
  sessionToken: string,
): Promise<PurchaseSubscriptionResponse> {
  const res = await fetch(`${API_BASE}/public/subscriptions/purchase`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? 'Subscription purchase failed');
  }
  const json = await res.json();
  return (json.data ?? json) as PurchaseSubscriptionResponse;
}

export async function getMySubscriptions(): Promise<ClientSubscription[]> {
  const res = await fetch(`${API_BASE}/public/subscriptions/my`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to fetch my subscriptions: ${res.status}`);
  const json = await res.json();
  return (json.data ?? json) as ClientSubscription[];
}