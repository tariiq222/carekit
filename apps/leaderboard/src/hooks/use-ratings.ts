import { useQuery } from '@tanstack/react-query'
import { ratingsApi } from '@carekit/api-client'
import type { RatingListQuery } from '@carekit/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function usePractitionerRatings(
  practitionerId: string,
  query: RatingListQuery = {},
) {
  return useQuery({
    queryKey: QUERY_KEYS.practitioners.ratings(
      practitionerId,
      query as Record<string, unknown>,
    ),
    queryFn: () => ratingsApi.listForPractitioner(practitionerId, query),
    enabled: !!practitionerId,
  })
}
