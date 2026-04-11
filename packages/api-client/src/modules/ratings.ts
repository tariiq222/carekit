import { apiRequest } from '../client.js'
import { buildQueryString } from '../types/api.js'
import type {
  RatingListQuery,
  RatingListResponse,
} from '../types/rating.js'

export async function listForEmployee(
  employeeId: string,
  query: RatingListQuery = {},
): Promise<RatingListResponse> {
  return apiRequest<RatingListResponse>(
    `/employees/${employeeId}/ratings${buildQueryString(query as Record<string, unknown>)}`,
  )
}
