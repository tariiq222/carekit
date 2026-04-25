/**
 * Billing Types — CareKit Dashboard
 * SaaS Plan 04 — billing skeleton
 */

// Slug is any admin-configured identifier — format enforced on the backend.
export type PlanSlug = string
export type BillingCycle = 'MONTHLY' | 'ANNUAL'
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED'
export type InvoiceStatus = 'DRAFT' | 'DUE' | 'PAID' | 'FAILED' | 'VOID'

export interface Plan {
  id: string
  slug: PlanSlug
  nameAr: string
  nameEn: string
  priceMonthly: string
  priceAnnual: string
  currency: string
  limits: Record<string, number | boolean>
  sortOrder: number
}

export interface Subscription {
  id: string
  organizationId: string
  status: SubscriptionStatus
  billingCycle: BillingCycle
  currentPeriodStart: string
  currentPeriodEnd: string
  trialEndsAt?: string | null
  canceledAt?: string | null
  pastDueSince?: string | null
  plan: Plan
  invoices?: SubscriptionInvoice[]
  usage?: Partial<Record<string, number>>
}

export interface SubscriptionInvoice {
  id: string
  amount: string
  flatAmount: string
  overageAmount: string
  lineItems: Array<{
    kind: 'FLAT_FEE' | 'OVERAGE'
    metric?: string
    description?: string
    amount: number
  }>
  currency: string
  status: InvoiceStatus
  billingCycle: BillingCycle
  periodStart: string
  periodEnd: string
  dueDate: string
  paidAt?: string | null
  receiptUrl?: string | null
}
