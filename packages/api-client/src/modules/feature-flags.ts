import { apiRequest } from '../client'

export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  return apiRequest<Record<string, boolean>>('/feature-flags/map')
}
