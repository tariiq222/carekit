import { apiRequest } from '../client.js'
import type { ClinicTheme } from '@carekit/shared/types'

export async function getWhitelabelPublic(): Promise<ClinicTheme> {
  return apiRequest<ClinicTheme>('/whitelabel/public')
}
