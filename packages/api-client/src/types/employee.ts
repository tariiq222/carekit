import type { PaginatedResponse, PaginationParams } from './api.js'

export interface PractitionerListItem {
  id: string
  isActive: boolean
  rating: number
  reviewCount: number
  experience: number
  bio: string | null
  bioAr: string | null
  createdAt: string
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
    avatarUrl: string | null
  }
  specialty: {
    id: string
    nameAr: string
    nameEn: string
    iconUrl: string | null
  }
}

export interface PractitionerStats {
  total: number
  active: number
  inactive: number
  newThisMonth: number
}

export interface PractitionerListQuery extends PaginationParams {
  isActive?: boolean
  specialtyId?: string
}

export interface CreatePractitionerPayload {
  userId: string
  specialtyId: string
  experience: number
  bio?: string
  bioAr?: string
}

export interface UpdatePractitionerPayload {
  specialtyId?: string
  experience?: number
  bio?: string
  bioAr?: string
  isActive?: boolean
}

export type PractitionerListResponse = PaginatedResponse<PractitionerListItem>

// ─── Breaks ────────────────────────────────────────────────────────────────

export interface PractitionerBreak {
  id: string
  practitionerId: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface BreakSlotInput {
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface SetBreaksPayload {
  breaks: BreakSlotInput[]
}

// ─── Vacations ─────────────────────────────────────────────────────────────

export interface PractitionerVacation {
  id: string
  practitionerId: string
  startDate: string
  endDate: string
  reason: string | null
  createdAt: string
}

export interface CreateVacationPayload {
  startDate: string
  endDate: string
  reason?: string
}

// ─── Practitioner Services ─────────────────────────────────────────────────

export interface PractitionerDurationOption {
  id: string
  label: string
  labelAr: string | null
  durationMinutes: number
  price: number
  isDefault: boolean
  sortOrder: number
}

export interface PractitionerTypeConfig {
  id: string
  bookingType: 'in_person' | 'online'
  price: number | null
  duration: number | null
  useCustomOptions: boolean
  isActive: boolean
  durationOptions: PractitionerDurationOption[]
}

export interface PractitionerService {
  id: string
  practitionerId: string
  serviceId: string
  customDuration: number | null
  bufferMinutes: number
  availableTypes: string[]
  isActive: boolean
  service: {
    id: string
    nameAr: string
    nameEn: string
    price: number
    duration: number
  }
  types: PractitionerTypeConfig[]
}

export interface AssignPractitionerServicePayload {
  serviceId: string
  customDuration?: number
  bufferMinutes?: number
  availableTypes: string[]
  isActive?: boolean
  types?: PractitionerTypeConfigInput[]
}

export interface UpdatePractitionerServicePayload {
  customDuration?: number | null
  bufferMinutes?: number
  availableTypes?: string[]
  isActive?: boolean
  types?: PractitionerTypeConfigInput[]
}

export interface PractitionerTypeConfigInput {
  bookingType: 'in_person' | 'online'
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
