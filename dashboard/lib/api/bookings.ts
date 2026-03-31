/**
 * Bookings API — CareKit Dashboard
 *
 * All booking-related API calls mapped to backend endpoints.
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/api"
import type {
  Booking,
  BookingListQuery,
  BookingStats,
  CreateBookingPayload,
  ReschedulePayload,
  CancelApprovePayload,
  CancelRejectPayload,
  AdminCancelPayload,
  PractitionerCancelPayload,
  CancelRequestPayload,
  CreateRecurringPayload,
  PatientReschedulePayload,
} from "@/lib/types/booking"

/* ─── Queries ─── */

export async function fetchBookings(
  query: BookingListQuery = {},
): Promise<PaginatedResponse<Booking>> {
  return api.get<PaginatedResponse<Booking>>("/bookings", {
    page: query.page,
    perPage: query.perPage,
    status: query.status,
    type: query.type,
    practitionerId: query.practitionerId,
    patientId: query.patientId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  })
}

export async function fetchBooking(id: string): Promise<Booking> {
  return api.get<Booking>(`/bookings/${id}`)
}

export async function fetchBookingStats(): Promise<BookingStats> {
  return api.get<BookingStats>("/bookings/stats")
}

/* ─── Mutations ─── */

export async function createBooking(
  payload: CreateBookingPayload,
): Promise<Booking> {
  return api.post<Booking>("/bookings", payload)
}

export async function rescheduleBooking(
  id: string,
  payload: ReschedulePayload,
): Promise<Booking> {
  return api.patch<Booking>(`/bookings/${id}`, payload)
}

export async function confirmBooking(id: string): Promise<Booking> {
  return api.post<Booking>(`/bookings/${id}/confirm`)
}

export async function completeBooking(id: string): Promise<Booking> {
  return api.post<Booking>(`/bookings/${id}/complete`)
}

export async function markNoShow(id: string): Promise<Booking> {
  return api.post<Booking>(`/bookings/${id}/no-show`)
}

export async function approveCancellation(
  id: string,
  payload: CancelApprovePayload,
): Promise<Booking> {
  return api.post<Booking>(
    `/bookings/${id}/cancel/approve`,
    payload,
  )
}

export async function rejectCancellation(
  id: string,
  payload: CancelRejectPayload,
): Promise<Booking> {
  return api.post<Booking>(
    `/bookings/${id}/cancel/reject`,
    payload,
  )
}

export async function checkInBooking(id: string): Promise<Booking> {
  return api.post<Booking>(`/bookings/${id}/check-in`)
}

export async function startBooking(id: string): Promise<Booking> {
  return api.post<Booking>(`/bookings/${id}/start`)
}

export async function adminCancelBooking(
  id: string,
  payload: AdminCancelPayload,
): Promise<Booking> {
  return api.post<Booking>(
    `/bookings/${id}/admin-cancel`,
    payload,
  )
}

export async function practitionerCancelBooking(
  id: string,
  payload: PractitionerCancelPayload,
): Promise<Booking> {
  return api.post<Booking>(
    `/bookings/${id}/practitioner-cancel`,
    payload,
  )
}

export async function requestCancellation(
  id: string,
  payload: CancelRequestPayload,
): Promise<Booking> {
  return api.post<Booking>(
    `/bookings/${id}/cancel-request`,
    payload,
  )
}

export async function createRecurringBooking(
  payload: CreateRecurringPayload,
): Promise<Booking[]> {
  return api.post<Booking[]>(
    "/bookings/recurring",
    payload,
  )
}

export async function patientReschedule(
  id: string,
  payload: PatientReschedulePayload,
): Promise<Booking> {
  return api.post<Booking>(
    `/bookings/${id}/patient-reschedule`,
    payload,
  )
}

/* ─── Status Log ─── */

export interface BookingStatusLogEntry {
  id: string
  bookingId: string
  fromStatus: string | null
  toStatus: string
  changedBy: string | null
  reason: string | null
  createdAt: string
}

export async function fetchBookingStatusLog(
  bookingId: string,
): Promise<BookingStatusLogEntry[]> {
  return api.get<BookingStatusLogEntry[]>(`/bookings/${bookingId}/status-log`)
}
