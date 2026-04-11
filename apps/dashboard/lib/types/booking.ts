/**
 * Booking Types — CareKit Dashboard
 *
 * Matches the backend Prisma schema + API response shapes.
 */

/**
 * Source of truth: shared/enums/booking.ts (TypeScript enums, UPPER_CASE)
 * Dashboard uses string union types (snake_case) for direct JSON compatibility.
 * Keep these in sync with the Prisma schema and shared/enums/booking.ts.
 */

/* ─── Enums ─── */

export type BookingType =
  | "in_person"
  | "online"
  | "walk_in"

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "pending_cancellation"
  | "no_show"
  | "checked_in"
  | "in_progress"
  | "expired"

export type RefundType = "full" | "partial" | "none"

export type CancelledBy = "patient" | "practitioner" | "admin" | "system"

/* ─── Entities ─── */

export interface BookingPatient {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
}

export interface BookingPractitioner {
  id: string
  userId: string
  user: { firstName: string; lastName: string }
  specialty: string
  specialtyAr: string
}

export interface BookingService {
  id: string
  nameAr: string
  nameEn: string
  price: number
  duration: number
}

export interface BookingPayment {
  id: string
  amount: number
  method: "moyasar" | "bank_transfer" | "cash"
  status: "pending" | "awaiting" | "paid" | "failed" | "refunded" | "rejected"
  totalAmount: number
}

export interface RescheduledFrom {
  id: string
  date: string
  startTime: string
}

/* ─── Main Booking ─── */

export interface Booking {
  id: string
  patientId: string | null
  practitionerId: string
  serviceId: string
  practitionerServiceId: string
  type: BookingType
  date: string
  startTime: string
  endTime: string
  status: BookingStatus
  notes: string | null
  zoomJoinUrl: string | null
  zoomHostUrl: string | null
  cancellationReason: string | null
  cancelledBy: CancelledBy | null
  suggestedRefundType: RefundType | null
  adminNotes: string | null
  cancelledAt: string | null
  confirmedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  patient: BookingPatient | null
  practitioner: BookingPractitioner
  service: BookingService
  practitionerService: { id: string } | null
  rescheduledFrom: RescheduledFrom | null
  payment: BookingPayment | null
  intakeFormId: string | null
  intakeFormAlreadySubmitted: boolean
}

/* ─── Query / Request DTOs ─── */

export interface BookingListQuery {
  page?: number
  perPage?: number
  status?: BookingStatus
  type?: BookingType
  practitionerId?: string
  patientId?: string
  dateFrom?: string
  dateTo?: string
}

export interface CreateBookingPayload {
  patientId?: string
  practitionerId: string
  serviceId: string
  type: BookingType
  durationOptionId?: string
  date: string
  startTime: string
  notes?: string
  payAtClinic?: boolean
  branchId?: string
  couponCode?: string
}

export interface ReschedulePayload {
  date?: string
  startTime?: string
}

export interface CancelApprovePayload {
  refundType: RefundType
  refundAmount?: number
  adminNotes?: string
}

export interface CancelRejectPayload {
  adminNotes?: string
}

export interface AdminCancelPayload {
  reason: string
  refundType: RefundType
  refundAmount?: number
  adminNotes?: string
}

export interface PractitionerCancelPayload {
  reason: string
}

export interface CancelRequestPayload {
  reason?: string
}

export interface CreateRecurringPayload {
  practitionerId: string
  serviceId: string
  type: BookingType
  date: string
  startTime: string
  notes?: string
  repeatEvery: "weekly" | "biweekly"
  repeatCount: number
}

export interface PatientReschedulePayload {
  date?: string
  startTime?: string
}

/* ─── Stats ─── */

export interface BookingStats {
  total: number
  confirmed: number
  pending: number
  completed: number
  cancelled: number
  pendingCancellation: number
  checkedIn: number
  inProgress: number
  noShow: number
  expired: number
}
