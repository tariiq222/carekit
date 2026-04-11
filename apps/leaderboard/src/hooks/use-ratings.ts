import { useQuery } from '@tanstack/react-query'
import * as ratingsApi from '../../../../packages/api-client/src/modules/ratings.js'
import type { RatingListQuery } from '../../../../packages/api-client/src/types/rating.js'

// TODO: move to QUERY_KEYS when parent wires it up
const ratingsKey = (practitionerId: string, query: RatingListQuery) =>
  ['practitioner-ratings', practitionerId, query] as const

export function usePractitionerRatings(
  practitionerId: string,
  query: RatingListQuery = {},
) {
  return useQuery({
    queryKey: ratingsKey(practitionerId, query),
    queryFn: () => ratingsApi.listForPractitioner(practitionerId, query),
    enabled: !!practitionerId,
  })
}
