/**
 * Billing API — CareKit Dashboard
 * SaaS Plan 04 — billing skeleton
 */

import { api } from "@/lib/api"
import type { Plan, Subscription, BillingCycle } from "@/lib/types/billing"

export const billingApi = {
  listPlans: () =>
    api.get<Plan[]>('/dashboard/billing/plans'),

  currentSubscription: () =>
    api.get<Subscription | null>('/dashboard/billing/subscription'),

  startSubscription: (dto: { planId: string; billingCycle: BillingCycle }) =>
    api.post<Subscription>('/dashboard/billing/subscription/start', dto),

  upgrade: (dto: { planId: string; billingCycle: BillingCycle }) =>
    api.post<Subscription>('/dashboard/billing/subscription/upgrade', dto),

  downgrade: (dto: { planId: string; billingCycle: BillingCycle }) =>
    api.post<Subscription>('/dashboard/billing/subscription/downgrade', dto),

  cancel: (reason?: string) =>
    api.post<Subscription>('/dashboard/billing/subscription/cancel', { reason }),

  resume: () =>
    api.post<Subscription>('/dashboard/billing/subscription/resume', {}),
}
