import { apiRequest } from '../client.js'
import type { BrandingConfig } from '@carekit/shared/types'

/**
 * Fetches public branding for a tenant from the unified branding endpoint.
 * Used by mobile app on startup and dashboard pre-auth.
 */
export async function getBrandingPublic(tenantId: string): Promise<BrandingConfig> {
  return apiRequest<BrandingConfig>(`/public/branding/${tenantId}`)
}
