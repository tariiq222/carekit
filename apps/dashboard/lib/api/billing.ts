/**
 * Billing API — CareKit Dashboard
 * SaaS Plan 04 — billing skeleton
 */

import { api } from "@/lib/api"
import type {
  AddSavedCardInput,
  BillingCycle,
  Plan,
  SavedCard,
  Subscription,
} from "@/lib/types/billing"

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

  scheduleCancel: (reason?: string) =>
    api.post<Subscription>('/dashboard/billing/subscription/schedule-cancel', { reason }),

  cancel: (reason?: string) =>
    api.post<Subscription>('/dashboard/billing/subscription/cancel', { reason }),

  resume: () =>
    api.post<Subscription>('/dashboard/billing/subscription/resume', {}),

  reactivate: () =>
    api.post<Subscription>('/dashboard/billing/subscription/reactivate', {}),

  listSavedCards: () =>
    api.get<SavedCard[]>('/dashboard/billing/saved-cards'),

  addSavedCard: (dto: AddSavedCardInput) =>
    api.post<SavedCard>('/dashboard/billing/saved-cards', dto),

  setDefaultSavedCard: (id: string) =>
    api.patch<SavedCard>(`/dashboard/billing/saved-cards/${id}/set-default`, {}),

  removeSavedCard: (id: string) =>
    api.delete<{ ok: true }>(`/dashboard/billing/saved-cards/${id}`),
}
