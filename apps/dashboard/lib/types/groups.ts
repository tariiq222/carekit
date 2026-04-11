export type GroupSchedulingMode = "fixed_date" | "on_capacity"
export type GroupStatus = "open" | "awaiting_payment" | "confirmed" | "full" | "completed" | "cancelled"
export type GroupEnrollmentStatus = "registered" | "payment_requested" | "confirmed" | "attended" | "expired" | "cancelled"
export type GroupPaymentType = "FREE_HOLD" | "DEPOSIT" | "FULL_PAYMENT"
export type DeliveryMode = "in_person" | "online"

export interface Group {
  id: string
  practitionerId: string
  nameAr: string
  nameEn: string
  descriptionAr: string | null
  descriptionEn: string | null
  minParticipants: number
  maxParticipants: number
  pricePerPersonHalalat: number
  durationMinutes: number
  paymentDeadlineHours: number
  paymentType: GroupPaymentType
  depositAmount: number | null
  remainingDueDate: string | null
  schedulingMode: GroupSchedulingMode
  startTime: string | null
  endTime: string | null
  endDate: string | null
  deliveryMode: DeliveryMode
  location: string | null
  meetingLink: string | null
  status: GroupStatus
  currentEnrollment: number
  reminderSent: boolean
  isPublished: boolean
  expiresAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  practitioner?: { id: string; nameAr: string | null }
  enrollments?: GroupEnrollment[]
}

export interface GroupEnrollment {
  id: string
  groupId: string
  patientId: string
  paymentId: string | null
  status: GroupEnrollmentStatus
  paymentDeadlineAt: string | null
  expiredAt: string | null
  attended: boolean
  attendedAt: string | null
  createdAt: string
  updatedAt: string
  patient?: { id: string; firstName: string; lastName: string; phone: string | null }
  payment?: { id: string; status: string } | null
}

export interface GroupCertificate {
  id: string
  enrollmentId: string
  groupId: string
  patientId: string
  issuedAt: string
}

export interface GroupListQuery {
  page?: number
  perPage?: number
  search?: string
  practitionerId?: string
  status?: GroupStatus
  deliveryMode?: DeliveryMode
  visibility?: "published" | "draft"
}

export interface CreateGroupPayload {
  nameAr: string
  nameEn: string
  descriptionAr?: string
  descriptionEn?: string
  practitionerId: string
  minParticipants: number
  maxParticipants: number
  pricePerPersonHalalat: number
  durationMinutes: number
  paymentDeadlineHours?: number
  paymentType: GroupPaymentType
  depositAmount?: number
  remainingDueDate?: string
  schedulingMode: GroupSchedulingMode
  startTime?: string
  endDate?: string
  deliveryMode: DeliveryMode
  location?: string
  meetingLink?: string
  isPublished?: boolean
  expiresAt?: string
}

export type UpdateGroupPayload = Partial<CreateGroupPayload>

export interface BulkAttendancePayload {
  attendedPatientIds: string[]
}

export interface ConfirmSchedulePayload {
  startTime: string
}

export interface ConfirmAttendancePayload {
  enrollmentId: string
  attended: boolean
}
