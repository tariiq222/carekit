"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchWhitelabel, updateWhitelabel } from "@/lib/api/whitelabel"
import type { UpdateWhitelabelPayload } from "@/lib/types/whitelabel"

export function useWhitelabel() {
  return useQuery({
    queryKey: queryKeys.whitelabel.config(),
    queryFn: fetchWhitelabel,
    staleTime: 10 * 60 * 1000,
  })
}

export function useUpdateWhitelabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateWhitelabelPayload) => updateWhitelabel(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.whitelabel.all })
    },
  })
}
