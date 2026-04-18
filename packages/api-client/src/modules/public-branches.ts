import { apiRequest } from '../client.js';
import type { PublicBranch } from '../types/public-directory.js';

export async function listPublicBranches(): Promise<PublicBranch[]> {
  return apiRequest<PublicBranch[]>('/public/branches');
}
