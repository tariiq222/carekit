export type SubscriptionBenefitType =
  | 'DISCOUNT_PERCENT'
  | 'DISCOUNT_FIXED'
  | 'SESSION_CREDITS'
  | 'FREE_SESSIONS';

export interface SubscriptionBenefit {
  type: SubscriptionBenefitType;
  value: number;
  serviceIds?: string[];
}

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PENDING';

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
  status: SubscriptionStatus;
  benefitsUsed: number;
  maxBenefits?: number;
  startDate?: string;
  endDate?: string;
  totalPaid: number;
  createdAt: string;
  plan: SubscriptionPlan;
}