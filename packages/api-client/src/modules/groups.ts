import { apiRequest } from '../client.js'
import { buildQueryString } from '../types/api.js'
import type { PaginatedResponse } from '../types/api.js'
import type { GroupListItem, GroupListQuery } from '../types/group.js'

export async function list(query: GroupListQuery = {}): Promise<PaginatedResponse<GroupListItem>> {
  return apiRequest<PaginatedResponse<GroupListItem>>(
    `/groups${buildQueryString(query as Record<string, unknown>)}`,
  )
}

export async function get(id: string): Promise<GroupListItem> {
  return apiRequest<GroupListItem>(`/groups/${id}`)
}
