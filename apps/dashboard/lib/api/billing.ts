/**
 * Billing API — Deqah Dashboard
 * SaaS Plan 04 — billing skeleton
 */

import { api } from "@/lib/api"
import type {
  AddSavedCardInput,
  ChangePlanInput,
  Plan,
  ProrationPreview,
  RetryPaymentResponse,
  SavedCard,
  Subscription,
} from "@/lib/types/billing"

export const billingApi = {
  listPlans: () =>
    api.get<Plan[]>('/dashboard/billing/plans'),

  currentSubscription: () =>
    api.get<Subscription | null>('/dashboard/billing/subscription'),

  startSubscription: (dto: ChangePlanInput) =>
    api.post<Subscription>('/dashboard/billing/subscription/start', dto),

  prorationPreview: (dto: ChangePlanInput) =>
    api.get<ProrationPreview>('/dashboard/billing/subscription/proration-preview', {
      planId: dto.planId,
      billingCycle: dto.billingCycle,
    }),

  upgrade: (dto: ChangePlanInput) =>
    api.post<Subscription>('/dashboard/billing/subscription/upgrade', dto),

  downgrade: (dto: ChangePlanInput) =>
    api.post<Subscription>('/dashboard/billing/subscription/downgrade', dto),

  scheduleDowngrade: (dto: ChangePlanInput) =>
    api.post<Subscription>('/dashboard/billing/subscription/schedule-downgrade', dto),

  cancelScheduledDowngrade: () =>
    api.post<Subscription>('/dashboard/billing/subscription/cancel-scheduled-downgrade', {}),

  scheduleCancel: (reason?: string) =>
    api.post<Subscription>('/dashboard/billing/subscription/schedule-cancel', { reason }),

  cancel: (reason?: string) =>
    api.post<Subscription>('/dashboard/billing/subscription/cancel', { reason }),

  resume: () =>
    api.post<Subscription>('/dashboard/billing/subscription/resume', {}),

  reactivate: () =>
    api.post<Subscription>('/dashboard/billing/subscription/reactivate', {}),

  retryPayment: () =>
    api.post<RetryPaymentResponse>('/dashboard/billing/subscription/retry-payment', {}),

  listSavedCards: () =>
    api.get<SavedCard[]>('/dashboard/billing/saved-cards'),

  addSavedCard: (dto: AddSavedCardInput) =>
    api.post<SavedCard>('/dashboard/billing/saved-cards', dto),

  setDefaultSavedCard: (id: string) =>
    api.patch<SavedCard>(`/dashboard/billing/saved-cards/${id}/set-default`, {}),

  removeSavedCard: (id: string) =>
    api.delete<{ ok: true }>(`/dashboard/billing/saved-cards/${id}`),
}
