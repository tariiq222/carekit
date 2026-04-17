import { apiRequest } from '../client.js'
import type { PublicEmployee } from '../types/public-directory.js'

export async function list(): Promise<PublicEmployee[]> {
  return apiRequest<PublicEmployee[]>('/public/employees')
}

export async function getBySlug(slug: string): Promise<PublicEmployee> {
  return apiRequest<PublicEmployee>(`/public/employees/${encodeURIComponent(slug)}`)
}
