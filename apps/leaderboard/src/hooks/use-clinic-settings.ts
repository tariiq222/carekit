import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clinicSettingsApi } from '@carekit/api-client'
import type { UpdateClinicSettingsPayload } from '@carekit/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function useClinicSettings() {
  return useQuery({
    queryKey: QUERY_KEYS.clinicSettings.detail,
    queryFn: () => clinicSettingsApi.get(),
  })
}

export function useUpdateClinicSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateClinicSettingsPayload) => clinicSettingsApi.update(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.clinicSettings.detail })
    },
  })
}
