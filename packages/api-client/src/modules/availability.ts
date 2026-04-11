import { apiRequest } from '../client.js'
import type {
  GetAvailabilityResponse,
  SetAvailabilityPayload,
  SetAvailabilityResponse,
  PractitionerAvailability,
} from '../types/availability.js'

export async function get(
  practitionerId: string,
): Promise<PractitionerAvailability[]> {
  const res = await apiRequest<GetAvailabilityResponse>(
    `/practitioners/${practitionerId}/availability`,
  )
  return res.schedule
}

export async function update(
  practitionerId: string,
  payload: SetAvailabilityPayload,
): Promise<PractitionerAvailability[]> {
  const res = await apiRequest<SetAvailabilityResponse>(
    `/practitioners/${practitionerId}/availability`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  )
  return res.data.schedule
}
