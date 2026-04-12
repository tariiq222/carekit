"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  fetchZatcaConfig,
  fetchOnboardingStatus,
  onboardZatca,
  reportToSandbox,
} from "@/lib/api/zatca"

const KEYS = {
  config: ["zatca", "config"] as const,
  onboarding: ["zatca", "onboarding"] as const,
}

export function useZatcaConfig() {
  return useQuery({
    queryKey: KEYS.config,
    queryFn: fetchZatcaConfig,
    staleTime: 30 * 60 * 1000,
  })
}

export function useOnboardingStatus() {
  return useQuery({
    queryKey: KEYS.onboarding,
    queryFn: fetchOnboardingStatus,
    staleTime: 30 * 60 * 1000,
  })
}

export function useZatcaMutations() {
  const queryClient = useQueryClient()
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["zatca"] })
  }

  const onboardMut = useMutation({
    mutationFn: onboardZatca,
    onSuccess: invalidateAll,
  })

  const reportMut = useMutation({
    mutationFn: reportToSandbox,
    onSuccess: invalidateAll,
  })

  return { onboardMut, reportMut }
}
