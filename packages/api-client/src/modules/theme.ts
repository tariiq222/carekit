import { apiRequest } from '../client.js'
import type { ClinicTheme } from '@carekit/shared/types'

/**
 * Fetches public branding/theme from the unified whitelabel endpoint.
 * Used by mobile app on startup.
 */
export async function getTheme(): Promise<ClinicTheme> {
  return apiRequest<ClinicTheme>('/whitelabel/public')
}
