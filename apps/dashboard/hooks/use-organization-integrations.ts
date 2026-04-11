"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchOrganizationIntegrations,
  updateOrganizationIntegrations,
} from "@/lib/api/organization-integrations"
import type { UpdateOrganizationIntegrationsPayload } from "@/lib/types/organization-integrations"

export function useOrganizationIntegrations() {
  return useQuery({
    queryKey: queryKeys.organizationIntegrations.config(),
    queryFn: fetchOrganizationIntegrations,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateOrganizationIntegrations() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateOrganizationIntegrationsPayload) =>
      updateOrganizationIntegrations(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.organizationIntegrations.all,
      })
    },
  })
}
