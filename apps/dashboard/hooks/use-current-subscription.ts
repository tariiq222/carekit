"use client"

/**
 * Billing hooks — CareKit Dashboard
 * SaaS Plan 04 — billing skeleton
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { billingApi } from '@/lib/api/billing'
import type { BillingCycle } from '@/lib/types/billing'

const BILLING_KEYS = {
  all: ['billing'] as const,
  subscription: () => ['billing', 'subscription'] as const,
  plans: () => ['billing', 'plans'] as const,
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

export function useBillingMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: BILLING_KEYS.all })

  const startMut = useMutation({
    mutationFn: (dto: { planId: string; billingCycle: BillingCycle }) =>
      billingApi.startSubscription(dto),
    onSuccess: invalidate,
  })

  const upgradeMut = useMutation({
    mutationFn: (dto: { planId: string; billingCycle: BillingCycle }) =>
      billingApi.upgrade(dto),
    onSuccess: invalidate,
  })

  const downgradeMut = useMutation({
    mutationFn: (dto: { planId: string; billingCycle: BillingCycle }) =>
      billingApi.downgrade(dto),
    onSuccess: invalidate,
  })

  const cancelMut = useMutation({
    mutationFn: (reason?: string) => billingApi.cancel(reason),
    onSuccess: invalidate,
  })

  const resumeMut = useMutation({
    mutationFn: () => billingApi.resume(),
    onSuccess: invalidate,
  })

  return { startMut, upgradeMut, downgradeMut, cancelMut, resumeMut }
}
