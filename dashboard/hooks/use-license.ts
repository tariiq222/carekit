"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchLicense,
  fetchLicenseFeatures,
  updateLicense,
} from "@/lib/api/license"
import type { UpdateLicensePayload } from "@/lib/types/license"

export function useLicense() {
  return useQuery({
    queryKey: queryKeys.license.config(),
    queryFn: fetchLicense,
    staleTime: 10 * 60 * 1000,
  })
}

export function useLicenseFeatures() {
  return useQuery({
    queryKey: queryKeys.license.features(),
    queryFn: fetchLicenseFeatures,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateLicense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateLicensePayload) => updateLicense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.license.all })
    },
  })
}
