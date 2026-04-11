import { apiRequest } from '../client.js'
import type { ClinicTheme } from '@carekit/shared/types'

export async function getTheme(): Promise<ClinicTheme> {
  return apiRequest<ClinicTheme>('/clinic-settings/theme')
}
