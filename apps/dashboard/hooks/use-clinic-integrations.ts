"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchClinicIntegrations,
  updateClinicIntegrations,
} from "@/lib/api/clinic-integrations"
import type { UpdateClinicIntegrationsPayload } from "@/lib/types/clinic-integrations"

export function useClinicIntegrations() {
  return useQuery({
    queryKey: queryKeys.clinicIntegrations.config(),
    queryFn: fetchClinicIntegrations,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateClinicIntegrations() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateClinicIntegrationsPayload) =>
      updateClinicIntegrations(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.clinicIntegrations.all,
      })
    },
  })
}
