import { apiRequest } from '../client.js'
import { buildQueryString } from '../types/api.js'
import type {
  RatingListQuery,
  RatingListResponse,
} from '../types/rating.js'

export async function listForPractitioner(
  practitionerId: string,
  query: RatingListQuery = {},
): Promise<RatingListResponse> {
  return apiRequest<RatingListResponse>(
    `/practitioners/${practitionerId}/ratings${buildQueryString(query as Record<string, unknown>)}`,
  )
}
