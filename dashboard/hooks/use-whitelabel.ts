"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchConfigMap, updateConfig } from "@/lib/api/whitelabel"

/* ─── Config Map ─── */

export function useConfigMap() {
  return useQuery({
    queryKey: queryKeys.whitelabel.configMap(),
    queryFn: fetchConfigMap,
    staleTime: 10 * 60 * 1000, // 10 min
  })
}

/* ─── Update Config ─── */

export function useUpdateConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.whitelabel.all })
    },
  })
}
