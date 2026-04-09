export type GroupSessionStatus = "open" | "confirmed" | "full" | "completed" | "cancelled"
export type GroupEnrollmentStatus = "registered" | "confirmed" | "attended" | "expired" | "cancelled"

export interface GroupOffering {
  id: string
  nameAr: string
  nameEn: string
  descriptionAr: string | null
  descriptionEn: string | null
  practitionerId: string
  minParticipants: number
  maxParticipants: number
  pricePerPersonHalalat: number
  durationMin: number
  paymentDeadlineHours: number
  createdAt: string
  updatedAt: string
  practitioner?: { id: string; nameAr: string | null }
  _count?: { sessions: number }
}

export interface GroupSession {
  id: string
  groupOfferingId: string
  startTime: string
  endTime: string
  status: GroupSessionStatus
  currentEnrollment: number
  registrationDeadline: string
  reminderSent: boolean
  createdAt: string
  updatedAt: string
  groupOffering?: {
    nameAr: string
    nameEn: string
    minParticipants: number
    maxParticipants: number
    pricePerPersonHalalat: number
    durationMin: number
    paymentDeadlineHours: number
    practitioner?: { id: string; nameAr: string | null }
  }
  enrollments?: GroupEnrollment[]
}

export interface GroupEnrollment {
  id: string
  groupSessionId: string
  patientId: string
  paymentId: string | null
  status: GroupEnrollmentStatus
  paymentDeadlineAt: string | null
  expiredAt: string | null
  createdAt: string
  updatedAt: string
  patient?: { id: string; firstName: string; lastName: string; phone: string | null }
  payment?: { id: string; status: string } | null
}

export interface OfferingListQuery {
  page?: number
  perPage?: number
  search?: string
  practitionerId?: string
}

export interface SessionListQuery {
  page?: number
  perPage?: number
  groupOfferingId?: string
  status?: GroupSessionStatus
}

export interface CreateOfferingPayload {
  nameAr: string
  nameEn: string
  descriptionAr?: string
  descriptionEn?: string
  practitionerId: string
  minParticipants: number
  maxParticipants: number
  pricePerPersonHalalat: number
  durationMin: number
  paymentDeadlineHours?: number
}

export type UpdateOfferingPayload = Partial<CreateOfferingPayload>

export interface CreateSessionPayload {
  startTime: string
  registrationDeadline: string
}

export interface MarkAttendancePayload {
  attendedPatientIds: string[]
}
