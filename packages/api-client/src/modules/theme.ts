import { apiRequest } from '../client.js'
import type { OrganizationTheme } from '@carekit/shared/types'

/**
 * Fetches public branding/theme from the unified whitelabel endpoint.
 * Used by mobile app on startup.
 */
export async function getTheme(): Promise<OrganizationTheme> {
  return apiRequest<OrganizationTheme>('/whitelabel/public')
}
