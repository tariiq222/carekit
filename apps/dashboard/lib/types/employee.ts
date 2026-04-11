/**
 * Practitioner Types — CareKit Dashboard
 */

import type { SearchableQuery } from "./common"

/* ─── Entities ─── */

export interface Practitioner {
  id: string
  userId: string
  title: string | null
  nameAr: string | null
  specialty: string
  specialtyAr: string | null
  bio: string | null
  bioAr: string | null
  experience: number | null
  education: string | null
  educationAr: string | null
  isActive: boolean
  isAcceptingBookings?: boolean
  priceClinic?: number | null
  pricePhone?: number | null
  priceVideo?: number | null
  avatarUrl?: string | null
  createdAt: string
  updatedAt: string
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
  }
  _count?: {
    bookings: number
    ratings: number
  }
  averageRating?: number
}

export interface AvailabilitySlot {
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

export interface Vacation {
  id: string
  startDate: string
  endDate: string
  reason: string | null
  createdAt: string
}

export interface PractitionerService {
  id: string
  serviceId: string
  customDuration: number | null
  bufferMinutes: number
  availableTypes: string[]
  isActive: boolean
  priceClinic?: number | null
  pricePhone?: number | null
  priceVideo?: number | null
  service: {
    id: string
    nameAr: string
    nameEn: string
    price: number
    duration: number
  }
  serviceTypes?: PractitionerServiceType[]
}

export interface PractitionerServiceType {
  id: string
  practitionerServiceId: string
  bookingType: string
  price: number | null
  duration: number | null
  useCustomOptions: boolean
  isActive: boolean
  durationOptions: PractitionerDurationOption[]
}

export interface PractitionerDurationOption {
  id: string
  practitionerServiceTypeId: string
  label: string
  labelAr: string | null
  durationMinutes: number
  price: number // halalat
  isDefault: boolean
  sortOrder: number
}

export interface PractitionerTypeConfigPayload {
  bookingType: string
  price?: number | null
  duration?: number | null
  useCustomOptions?: boolean
  isActive?: boolean
  durationOptions?: {
    label: string
    labelAr?: string
    durationMinutes: number
    price: number
    isDefault?: boolean
    sortOrder?: number
  }[]
}

export interface BreakSlot {
  id?: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface TimeSlot {
  startTime: string
  endTime: string
}

/* ─── Query ─── */

export interface PractitionerListQuery extends SearchableQuery {
  specialty?: string
  minRating?: number
  isActive?: boolean
}

/* ─── DTOs ─── */

export interface CreatePractitionerPayload {
  userId: string
  specialty: string
  specialtyAr?: string
  bio?: string
  bioAr?: string
  experience?: number
  education?: string
  educationAr?: string
  avatarUrl?: string | null
}

export interface UpdatePractitionerPayload {
  title?: string
  nameAr?: string
  specialty?: string
  specialtyAr?: string
  bio?: string
  bioAr?: string
  experience?: number
  education?: string
  educationAr?: string
  isActive?: boolean
  avatarUrl?: string | null
}

export interface SetAvailabilityPayload {
  schedule: AvailabilitySlot[]
}

export interface CreateVacationPayload {
  startDate: string
  endDate: string
  reason?: string
}

export interface SetBreaksPayload {
  breaks: Omit<BreakSlot, "id">[]
}

export interface AssignServicePayload {
  serviceId: string
  customDuration?: number
  bufferMinutes?: number
  availableTypes: string[]
  isActive?: boolean
  types?: PractitionerTypeConfigPayload[]
}

export interface UpdateServicePayload {
  customDuration?: number | null
  bufferMinutes?: number
  availableTypes?: string[]
  isActive?: boolean
  types?: PractitionerTypeConfigPayload[]
}

export interface OnboardPractitionerPayload {
  title?: string
  nameEn: string
  nameAr: string
  email: string
  specialty: string
  specialtyAr?: string
  bio?: string
  bioAr?: string
  experience?: number
  education?: string
  educationAr?: string
  avatarUrl?: string | null
  isActive?: boolean
}

export interface OnboardPractitionerResponse {
  success: boolean
  message: string
  practitioner: Practitioner
}
