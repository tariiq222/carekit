import { apiRequest } from '../client.js';
import { buildQueryString } from '../types/api.js';
import type { AvailableSlot } from '@carekit/shared';

export async function getPublicAvailability(
  employeeId: string,
  date: string,
  serviceId?: string,
): Promise<AvailableSlot[]> {
  const params: Record<string, string> = { date };
  if (serviceId) params['serviceId'] = serviceId;
  return apiRequest<AvailableSlot[]>(
    `/public/employees/${employeeId}/availability${buildQueryString(params)}`,
  );
}