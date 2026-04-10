import { apiRequest } from '../client.js'
import type { WhitelabelConfig } from '../types/index.js'

export async function getWhitelabelConfig(): Promise<WhitelabelConfig> {
  return apiRequest<WhitelabelConfig>('/whitelabel/config')
}
