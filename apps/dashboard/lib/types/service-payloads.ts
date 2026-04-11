/**
 * Service & Specialty Payload Types (DTOs) — CareKit Dashboard
 */

/* ─── Category DTOs ─── */

export interface CreateCategoryPayload {
  nameEn: string
  nameAr: string
  sortOrder?: number
  departmentId: string
}

export interface UpdateCategoryPayload {
  nameEn?: string
  nameAr?: string
  sortOrder?: number
  isActive?: boolean
  departmentId?: string
}

/* ─── Service DTOs ─── */

export interface CreateServicePayload {
  nameEn: string
  nameAr: string
  descriptionEn?: string
  descriptionAr?: string
  categoryId: string
  price?: number
  duration?: number
  isActive?: boolean
  isHidden?: boolean
  hidePriceOnBooking?: boolean
  hideDurationOnBooking?: boolean
  iconName?: string | null
  iconBgColor?: string | null
  imageUrl?: string | null
  bufferMinutes?: number
  depositEnabled?: boolean
  depositPercent?: number
  allowRecurring?: boolean
  allowedRecurringPatterns?: string[]
  maxRecurrences?: number
  maxParticipants?: number
  minLeadMinutes?: number | null
  maxAdvanceDays?: number | null
  practitionerIds?: string[]
  branchIds?: string[]
}

export interface UpdateServicePayload {
  nameEn?: string
  nameAr?: string
  descriptionEn?: string
  descriptionAr?: string
  categoryId?: string
  price?: number
  duration?: number
  isActive?: boolean
  isHidden?: boolean
  hidePriceOnBooking?: boolean
  hideDurationOnBooking?: boolean
  iconName?: string | null
  iconBgColor?: string | null
  imageUrl?: string | null
  bufferMinutes?: number
  depositEnabled?: boolean
  depositPercent?: number
  allowRecurring?: boolean
  allowedRecurringPatterns?: string[]
  maxRecurrences?: number
  maxParticipants?: number
  minLeadMinutes?: number | null
  maxAdvanceDays?: number | null
}

/* ─── Specialty DTOs ─── */

export interface CreateSpecialtyPayload {
  nameEn: string
  nameAr: string
  descriptionEn?: string
  descriptionAr?: string
  iconUrl?: string
  sortOrder?: number
}

export interface UpdateSpecialtyPayload {
  nameEn?: string
  nameAr?: string
  descriptionEn?: string
  descriptionAr?: string
  iconUrl?: string
  sortOrder?: number
  isActive?: boolean
}

/* ─── Duration Options Payloads ─── */

export interface DurationOptionPayload {
  label: string
  labelAr?: string
  durationMinutes: number
  price: number // halalat
  isDefault?: boolean
  sortOrder?: number
}

export interface SetDurationOptionsPayload {
  options: DurationOptionPayload[]
}

/* ─── Booking Type Payloads ─── */

export interface DurationOptionInput {
  label: string
  labelAr?: string
  durationMinutes: number
  price: number // halalat
  isDefault?: boolean
  sortOrder?: number
}

export interface BookingTypeConfigPayload {
  bookingType: 'in_person' | 'online'
  price: number // halalat
  duration: number // minutes
  isActive?: boolean
  durationOptions?: DurationOptionInput[]
}

export interface SetServiceBookingTypesPayload {
  types: BookingTypeConfigPayload[]
}

/* ─── Intake Forms Payloads ─── */

export interface CreateIntakeFormPayload {
  titleAr: string
  titleEn: string
  isRequired?: boolean
  isActive?: boolean
}

export interface UpdateIntakeFormPayload {
  titleAr?: string
  titleEn?: string
  isRequired?: boolean
  isActive?: boolean
}

export interface IntakeFieldPayload {
  labelAr: string
  labelEn: string
  fieldType: string
  options?: string[]
  isRequired?: boolean
  sortOrder?: number
}

export interface SetFieldsPayload {
  fields: IntakeFieldPayload[]
}
