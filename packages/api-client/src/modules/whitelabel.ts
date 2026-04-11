import { apiRequest } from '../client.js'
import type { OrganizationTheme } from '@carekit/shared/types'

export async function getWhitelabelPublic(): Promise<OrganizationTheme> {
  return apiRequest<OrganizationTheme>('/whitelabel/public')
}
