"use client"

/**
 * Billing hooks — CareKit Dashboard
 * SaaS Plan 04 — billing skeleton
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { billingApi } from '@/lib/api/billing'
import type { AddSavedCardInput, ChangePlanInput } from '@/lib/types/billing'

const BILLING_KEYS = {
  all: ['billing'] as const,
  subscription: () => ['billing', 'subscription'] as const,
  plans: () => ['billing', 'plans'] as const,
  savedCards: () => ['billing', 'saved-cards'] as const,
  prorationPreview: (dto: ChangePlanInput) =>
    ['billing', 'proration-preview', dto.planId, dto.billingCycle] as const,
}

export function useCurrentSubscription() {
  return useQuery({
    queryKey: BILLING_KEYS.subscription(),
    queryFn: () => billingApi.currentSubscription().then((s) => s ?? null),
  })
}

export function usePlans() {
  return useQuery({
    queryKey: BILLING_KEYS.plans(),
    queryFn: () => billingApi.listPlans(),
    staleTime: 5 * 60 * 1000,
  })
}

export function useSavedCards() {
  return useQuery({
    queryKey: BILLING_KEYS.savedCards(),
    queryFn: () => billingApi.listSavedCards(),
  })
}

export function useProrationPreview(dto: ChangePlanInput | null) {
  return useQuery({
    queryKey: dto ? BILLING_KEYS.prorationPreview(dto) : ['billing', 'proration-preview', 'idle'],
    queryFn: () => billingApi.prorationPreview(dto as ChangePlanInput),
    enabled: dto !== null,
  })
}

export function useBillingMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: BILLING_KEYS.all })

  const startMut = useMutation({
    mutationFn: (dto: ChangePlanInput) =>
      billingApi.startSubscription(dto),
    onSuccess: invalidate,
  })

  const upgradeMut = useMutation({
    mutationFn: (dto: ChangePlanInput) =>
      billingApi.upgrade(dto),
    onSuccess: invalidate,
  })

  const downgradeMut = useMutation({
    mutationFn: (dto: ChangePlanInput) =>
      billingApi.downgrade(dto),
    onSuccess: invalidate,
  })

  const scheduleDowngradeMut = useMutation({
    mutationFn: (dto: ChangePlanInput) => billingApi.scheduleDowngrade(dto),
    onSuccess: invalidate,
  })

  const cancelScheduledDowngradeMut = useMutation({
    mutationFn: () => billingApi.cancelScheduledDowngrade(),
    onSuccess: invalidate,
  })

  const cancelMut = useMutation({
    mutationFn: (reason?: string) => billingApi.cancel(reason),
    onSuccess: invalidate,
  })

  const scheduleCancelMut = useMutation({
    mutationFn: (reason?: string) => billingApi.scheduleCancel(reason),
    onSuccess: invalidate,
  })

  const resumeMut = useMutation({
    mutationFn: () => billingApi.resume(),
    onSuccess: invalidate,
  })

  const reactivateMut = useMutation({
    mutationFn: () => billingApi.reactivate(),
    onSuccess: invalidate,
  })

  const addSavedCardMut = useMutation({
    mutationFn: (dto: AddSavedCardInput) =>
      billingApi.addSavedCard({
        ...dto,
        idempotencyKey: dto.idempotencyKey ?? crypto.randomUUID(),
      }),
    onSuccess: invalidate,
  })

  const setDefaultSavedCardMut = useMutation({
    mutationFn: (id: string) => billingApi.setDefaultSavedCard(id),
    onSuccess: invalidate,
  })

  const removeSavedCardMut = useMutation({
    mutationFn: (id: string) => billingApi.removeSavedCard(id),
    onSuccess: invalidate,
  })

  return {
    startMut,
    upgradeMut,
    downgradeMut,
    scheduleDowngradeMut,
    cancelScheduledDowngradeMut,
    cancelMut,
    scheduleCancelMut,
    resumeMut,
    reactivateMut,
    addSavedCardMut,
    setDefaultSavedCardMut,
    removeSavedCardMut,
  }
}
