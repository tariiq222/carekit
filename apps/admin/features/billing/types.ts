export type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'SUSPENDED'
  | 'CANCELED';

export type SubscriptionInvoiceStatus =
  | 'DRAFT'
  | 'DUE'
  | 'PAID'
  | 'FAILED'
  | 'VOID';

export type BillingCycle = 'MONTHLY' | 'ANNUAL';

export interface SubscriptionRow {
  id: string;
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  canceledAt: string | null;
  pastDueSince: string | null;
  lastPaymentAt: string | null;
  lastFailureReason: string | null;
  createdAt: string;
  plan: { slug: string; nameEn: string; priceMonthly: string | number };
}

export interface SubscriptionInvoiceRow {
  id: string;
  subscriptionId: string;
  organizationId: string;
  amount: string | number;
  flatAmount: string | number;
  overageAmount: string | number;
  currency: string;
  status: SubscriptionInvoiceStatus;
  billingCycle: BillingCycle;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  issuedAt: string | null;
  paidAt: string | null;
  refundedAmount: string | number | null;
  refundedAt: string | null;
  voidedReason: string | null;
  createdAt: string;
}

export interface BillingMetrics {
  mrr: string;
  arr: string;
  currency: string;
  counts: Record<SubscriptionStatus, number>;
  churn30d: number;
  byPlan: Array<{ planId: string; planSlug: string; activeCount: number; mrr: string }>;
}

export interface UsageRow {
  metric: string;
  count: number;
  periodStart: string;
  periodEnd: string;
}

export interface CreditRow {
  id: string;
  amount: string | number;
  currency: string;
  reason: string;
  grantedByUserId: string;
  grantedAt: string;
  consumedInvoiceId: string | null;
  consumedAt: string | null;
}

export interface OrgBillingDetail {
  org: {
    id: string;
    slug: string;
    nameAr: string;
    nameEn: string | null;
    status: string;
  };
  subscription:
    | (SubscriptionRow & { plan: { slug: string; nameEn: string; priceMonthly: string | number } })
    | null;
  invoices: SubscriptionInvoiceRow[];
  usage: UsageRow[];
  credits: CreditRow[];
}
