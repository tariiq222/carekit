export type CourseStatus = "draft" | "published" | "in_progress" | "completed" | "archived"
export type CourseSessionStatus = "scheduled" | "completed" | "cancelled"
export type CourseEnrollmentStatus = "enrolled" | "active" | "completed" | "dropped" | "refunded"
export type CourseFrequency = "weekly" | "biweekly" | "monthly"
export type DeliveryMode = "in_person" | "online" | "hybrid"

export interface CourseSession {
  id: string
  courseId: string
  sessionNumber: number
  titleAr: string | null
  titleEn: string | null
  scheduledAt: string
  status: CourseSessionStatus
  createdAt: string
  updatedAt: string
}

export interface CourseEnrollment {
  id: string
  courseId: string
  patientId: string
  status: CourseEnrollmentStatus
  sessionsAttended: number
  enrolledAt: string
  completedAt: string | null
  createdAt: string
  updatedAt: string
  patient?: { id: string; firstName: string; lastName: string; phone: string | null }
  payment?: { id: string; status: string; amount: number } | null
}

export interface Course {
  id: string
  nameAr: string
  nameEn: string
  descriptionAr: string | null
  descriptionEn: string | null
  practitionerId: string
  totalSessions: number
  durationPerSessionMin: number
  frequency: CourseFrequency
  priceHalalat: number
  isGroup: boolean
  maxParticipants: number | null
  deliveryMode: DeliveryMode
  location: string | null
  status: CourseStatus
  startDate: string
  currentEnrollment: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  practitioner?: { id: string; nameAr: string | null }
  sessions?: CourseSession[]
  enrollments?: CourseEnrollment[]
}

export interface CourseListQuery {
  page?: number
  perPage?: number
  search?: string
  practitionerId?: string
  status?: CourseStatus
  deliveryMode?: DeliveryMode
  isGroup?: boolean
}

export interface CreateCoursePayload {
  nameAr: string
  nameEn: string
  descriptionAr?: string
  descriptionEn?: string
  practitionerId: string
  totalSessions: number
  durationPerSessionMin: number
  frequency: CourseFrequency
  priceHalalat: number
  isGroup: boolean
  maxParticipants?: number
  deliveryMode: DeliveryMode
  location?: string
  startDate: string
}

export type UpdateCoursePayload = Partial<Omit<CreateCoursePayload, "startDate">>

export interface MarkCourseAttendancePayload {
  sessionId: string
  attendedPatientIds: string[]
}

export interface EnrollCourseResult {
  enrollment: CourseEnrollment
  paymentUrl: string | null
}
