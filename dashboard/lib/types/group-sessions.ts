export type GroupSessionSchedulingMode = "fixed_date" | "on_capacity"
export type GroupSessionStatus = "open" | "confirmed" | "full" | "completed" | "cancelled"
export type GroupEnrollmentStatus = "registered" | "confirmed" | "attended" | "expired" | "cancelled"

export interface GroupSession {
  id: string
  practitionerId: string
  departmentId: string | null
  nameAr: string
  nameEn: string
  descriptionAr: string | null
  descriptionEn: string | null
  minParticipants: number
  maxParticipants: number
  pricePerPersonHalalat: number
  durationMinutes: number
  paymentDeadlineHours: number
  schedulingMode: GroupSessionSchedulingMode
  startTime: string | null
  endTime: string | null
  status: GroupSessionStatus
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

export interface GroupSessionListQuery {
  page?: number
  perPage?: number
  search?: string
  practitionerId?: string
  status?: GroupSessionStatus
  visibility?: "published" | "draft"
}

export interface CreateGroupSessionPayload {
  nameAr: string
  nameEn: string
  descriptionAr?: string
  descriptionEn?: string
  practitionerId: string
  departmentId?: string
  minParticipants: number
  maxParticipants: number
  pricePerPersonHalalat: number
  durationMinutes: number
  paymentDeadlineHours?: number
  schedulingMode: GroupSessionSchedulingMode
  startTime?: string
  isPublished?: boolean
  expiresAt?: string
}

export type UpdateGroupSessionPayload = Partial<CreateGroupSessionPayload>

export interface MarkAttendancePayload {
  attendedPatientIds: string[]
}
