"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchBranding, updateBranding } from "@/lib/api/branding"
import type { UpdateBrandingPayload } from "@/lib/types/branding"

export function useBranding() {
  return useQuery({
    queryKey: queryKeys.branding.config(),
    queryFn: fetchBranding,
    staleTime: 10 * 60 * 1000,
  })
}

export function useUpdateBranding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateBrandingPayload) => updateBranding(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.branding.all })
    },
  })
}
