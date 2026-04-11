/**
 * Practitioners Schedule API — CareKit Dashboard
 * (availability, breaks, slots, vacations, services, ratings)
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  AvailabilitySlot,
  SetAvailabilityPayload,
  BreakSlot,
  SetBreaksPayload,
  Vacation,
  CreateVacationPayload,
  PractitionerService,
  PractitionerServiceType,
  AssignServicePayload,
  UpdateServicePayload,
  TimeSlot,
} from "@/lib/types/practitioner"
import type { Rating } from "@/lib/types/rating"

/* ─── Availability ─── */

export async function fetchAvailability(
  id: string,
): Promise<AvailabilitySlot[]> {
  const res = await api.get<{ schedule: AvailabilitySlot[] }>(
    `/practitioners/${id}/availability`,
  )
  return res.schedule
}

export async function setAvailability(
  id: string,
  payload: SetAvailabilityPayload,
): Promise<void> {
  await api.put(`/practitioners/${id}/availability`, payload)
}

/* ─── Breaks ─── */

export async function fetchBreaks(id: string): Promise<BreakSlot[]> {
  return api.get<BreakSlot[]>(
    `/practitioners/${id}/breaks`,
  )
}

export async function setBreaks(
  id: string,
  payload: SetBreaksPayload,
): Promise<BreakSlot[]> {
  return api.put<BreakSlot[]>(
    `/practitioners/${id}/breaks`,
    payload,
  )
}

/* ─── Slots ─── */

export async function fetchSlots(
  id: string,
  date: string,
  duration?: number,
): Promise<TimeSlot[]> {
  const res = await api.get<TimeSlot[] | { slots: TimeSlot[] }>(
    `/practitioners/${id}/slots`,
    { date, duration },
  )
  return Array.isArray(res) ? res : (res.slots ?? [])
}

/* ─── Vacations ─── */

export async function fetchVacations(id: string): Promise<Vacation[]> {
  return api.get<Vacation[]>(
    `/practitioners/${id}/vacations`,
  )
}

export async function createVacation(
  id: string,
  payload: CreateVacationPayload,
): Promise<Vacation> {
  return api.post<Vacation>(
    `/practitioners/${id}/vacations`,
    payload,
  )
}

export async function deleteVacation(
  practitionerId: string,
  vacationId: string,
): Promise<void> {
  await api.delete(
    `/practitioners/${practitionerId}/vacations/${vacationId}`,
  )
}

/* ─── Practitioner Services ─── */

export async function fetchPractitionerServices(
  id: string,
): Promise<PractitionerService[]> {
  return api.get<PractitionerService[]>(
    `/practitioners/${id}/services`,
  )
}

export async function assignService(
  id: string,
  payload: AssignServicePayload,
): Promise<PractitionerService> {
  return api.post<PractitionerService>(
    `/practitioners/${id}/services`,
    payload,
  )
}

export async function updatePractitionerService(
  practitionerId: string,
  serviceId: string,
  payload: UpdateServicePayload,
): Promise<PractitionerService> {
  return api.patch<PractitionerService>(
    `/practitioners/${practitionerId}/services/${serviceId}`,
    payload,
  )
}

export async function removePractitionerService(
  practitionerId: string,
  serviceId: string,
): Promise<void> {
  await api.delete(
    `/practitioners/${practitionerId}/services/${serviceId}`,
  )
}

/* ─── Practitioner Service Types ─── */

export async function fetchPractitionerServiceTypes(
  practitionerId: string,
  serviceId: string,
): Promise<PractitionerServiceType[]> {
  return api.get<PractitionerServiceType[]>(
    `/practitioners/${practitionerId}/services/${serviceId}/types`,
  )
}

/* ─── Ratings ─── */

export async function fetchPractitionerRatings(
  id: string,
  query: { page?: number; perPage?: number } = {},
): Promise<PaginatedResponse<Rating>> {
  return api.get<PaginatedResponse<Rating>>(
    `/practitioners/${id}/ratings`,
    { page: query.page, perPage: query.perPage },
  )
}
