import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as availabilityApi from '../../../../packages/api-client/src/modules/availability.js'
import type { SetAvailabilityPayload } from '../../../../packages/api-client/src/types/availability.js'

// TODO: move to QUERY_KEYS when parent wires it up
const availabilityKey = (practitionerId: string) =>
  ['practitioner-availability', practitionerId] as const

export function usePractitionerAvailability(practitionerId: string) {
  return useQuery({
    queryKey: availabilityKey(practitionerId),
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
      qc.invalidateQueries({ queryKey: availabilityKey(practitionerId) })
    },
  })
}
