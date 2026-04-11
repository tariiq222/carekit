import type { PaginatedResponse, PaginationParams } from './api.js'

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'pending_cancellation'
  | 'no_show'
  | 'expired'

export type BookingType = 'in_person' | 'online' | 'walk_in'

export interface BookingListItem {
  id: string
  date: string
  startTime: string
  endTime: string
  status: BookingStatus
  type: BookingType
  isWalkIn: boolean
  bookedPrice: number | null
  notes: string | null
  adminNotes: string | null
  createdAt: string
  patient: {
    id: string
    firstName: string
    lastName: string
    phone: string | null
  } | null
  practitioner: {
    id: string
    user: { firstName: string; lastName: string }
    specialty: { nameAr: string; nameEn: string }
  }
  service: { nameAr: string; nameEn: string; price: number; duration: number }
}

export interface BookingStats {
  total: number
  today: number
  pending: number
  confirmed: number
  completed: number
  cancelled: number
}

export interface BookingListQuery extends PaginationParams {
  status?: BookingStatus
  type?: BookingType
  practitionerId?: string
  patientId?: string
  dateFrom?: string
  dateTo?: string
}

export interface CreateBookingPayload {
  practitionerId: string
  serviceId: string
  type: BookingType
  date: string
  startTime: string
  patientId?: string
  notes?: string
  branchId?: string
}

export interface UpdateBookingPayload {
  status?: BookingStatus
  adminNotes?: string
}

export type BookingListResponse = PaginatedResponse<BookingListItem>
