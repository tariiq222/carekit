/**
 * Employees Schedule API — CareKit Dashboard
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
  EmployeeService,
  EmployeeServiceType,
  AssignServicePayload,
  UpdateServicePayload,
  TimeSlot,
} from "@/lib/types/employee"
import type { Rating } from "@/lib/types/rating"

/* ─── Availability ─── */

export async function fetchAvailability(
  id: string,
): Promise<AvailabilitySlot[]> {
  const res = await api.get<{ schedule: AvailabilitySlot[] }>(
    `/dashboard/people/employees/${id}/availability`,
  )
  return res.schedule
}

export async function setAvailability(
  id: string,
  payload: SetAvailabilityPayload,
): Promise<void> {
  await api.put(`/dashboard/people/employees/${id}/availability`, payload)
}

/* ─── Breaks ─── */

export async function fetchBreaks(id: string): Promise<BreakSlot[]> {
  return api.get<BreakSlot[]>(
    `/dashboard/people/employees/${id}/breaks`,
  )
}

export async function setBreaks(
  id: string,
  payload: SetBreaksPayload,
): Promise<BreakSlot[]> {
  return api.put<BreakSlot[]>(
    `/dashboard/people/employees/${id}/breaks`,
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
    `/dashboard/people/employees/${id}/slots`,
    { date, duration },
  )
  return Array.isArray(res) ? res : (res.slots ?? [])
}

/* ─── Vacations ─── */

export async function fetchVacations(id: string): Promise<Vacation[]> {
  return api.get<Vacation[]>(
    `/dashboard/people/employees/${id}/vacations`,
  )
}

export async function createVacation(
  id: string,
  payload: CreateVacationPayload,
): Promise<Vacation> {
  return api.post<Vacation>(
    `/dashboard/people/employees/${id}/vacations`,
    payload,
  )
}

export async function deleteVacation(
  employeeId: string,
  vacationId: string,
): Promise<void> {
  await api.delete(
    `/dashboard/people/employees/${employeeId}/vacations/${vacationId}`,
  )
}

/* ─── Employee Services ─── */

export async function fetchEmployeeServices(
  id: string,
): Promise<EmployeeService[]> {
  return api.get<EmployeeService[]>(
    `/dashboard/people/employees/${id}/services`,
  )
}

export async function assignService(
  id: string,
  payload: AssignServicePayload,
): Promise<EmployeeService> {
  return api.post<EmployeeService>(
    `/dashboard/people/employees/${id}/services`,
    payload,
  )
}

export async function updateEmployeeService(
  employeeId: string,
  serviceId: string,
  payload: UpdateServicePayload,
): Promise<EmployeeService> {
  return api.patch<EmployeeService>(
    `/dashboard/people/employees/${employeeId}/services/${serviceId}`,
    payload,
  )
}

export async function removeEmployeeService(
  employeeId: string,
  serviceId: string,
): Promise<void> {
  await api.delete(
    `/dashboard/people/employees/${employeeId}/services/${serviceId}`,
  )
}

/* ─── Employee Service Types ─── */

export async function fetchEmployeeServiceTypes(
  employeeId: string,
  serviceId: string,
): Promise<EmployeeServiceType[]> {
  return api.get<EmployeeServiceType[]>(
    `/dashboard/people/employees/${employeeId}/services/${serviceId}/types`,
  )
}

/* ─── Ratings ─── */

export async function fetchEmployeeRatings(
  id: string,
  query: { page?: number; perPage?: number } = {},
): Promise<PaginatedResponse<Rating>> {
  return api.get<PaginatedResponse<Rating>>(
    `/dashboard/people/employees/${id}/ratings`,
    { page: query.page, limit: query.perPage },
  )
}
