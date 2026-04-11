import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { availabilityApi } from '@carekit/api-client'
import type { SetAvailabilityPayload } from '@carekit/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function usePractitionerAvailability(practitionerId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.practitioners.availability(practitionerId),
    queryFn: () => availabilityApi.get(practitionerId),
    enabled: !!practitionerId,
  })
}

export function useUpdatePractitionerAvailability(practitionerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: SetAvailabilityPayload) =>
      availabilityApi.update(practitionerId, payload),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: QUERY_KEYS.practitioners.availability(practitionerId),
      })
    },
  })
}
