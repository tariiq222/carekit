/**
 * Service & Specialty Types — CareKit Dashboard
 */

import type { PaginatedQuery } from "./common"

/* ─── Entities ─── */

export interface ServiceCategory {
  id: string
  nameEn: string
  nameAr: string
  sortOrder: number
  isActive: boolean
  createdAt: string
  _count?: { services: number }
}

export interface Service {
  id: string
  nameEn: string
  nameAr: string
  descriptionEn: string | null
  descriptionAr: string | null
  categoryId: string
  price: number
  duration: number
  isActive: boolean
  isHidden: boolean
  hidePriceOnBooking: boolean
  hideDurationOnBooking: boolean
  iconName: string | null
  iconBgColor: string | null
  imageUrl: string | null
  bufferMinutes: number
  depositEnabled: boolean
  depositPercent: number
  allowRecurring: boolean
  allowedRecurringPatterns: string[]
  maxRecurrences: number
  maxParticipants: number
  minLeadMinutes: number | null
  maxAdvanceDays: number | null
  createdAt: string
  updatedAt: string
  category?: ServiceCategory
  bookingTypes?: ServiceBookingType[]
  durationOptions?: ServiceDurationOption[]
  intakeForms?: IntakeForm[]
  branches?: { branchId: string }[]
}

export interface ServiceBookingType {
  id: string
  serviceId: string
  bookingType: 'in_person' | 'online'
  price: number // halalat
  duration: number // minutes
  isActive: boolean
  durationOptions: ServiceDurationOption[]
}

export interface ServiceDurationOption {
  id: string
  serviceId: string
  serviceBookingTypeId?: string
  label: string
  labelAr: string | null
  durationMinutes: number
  price: number // halalat
  isDefault: boolean
  sortOrder: number
}

export interface IntakeForm {
  id: string
  serviceId: string
  titleAr: string
  titleEn: string
  isRequired: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  fields: IntakeField[]
}

export interface IntakeField {
  id: string
  formId: string
  labelAr: string
  labelEn: string
  fieldType: string
  options: string[] | null
  isRequired: boolean
  sortOrder: number
}

export interface IntakeResponse {
  id: string
  formId: string
  bookingId: string
  patientId: string
  answers: Record<string, string>
  createdAt: string
  form?: IntakeForm
}

export interface Specialty {
  id: string
  nameEn: string
  nameAr: string
  descriptionEn: string | null
  descriptionAr: string | null
  iconUrl: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  _count?: { practitioners: number }
}

/* ─── Query ─── */

export interface ServiceListQuery extends PaginatedQuery {
  categoryId?: string
  isActive?: boolean
  includeHidden?: boolean
  search?: string
  branchId?: string
}

export interface SetServiceBranchesPayload {
  branchIds: string[]
}

/* ─── Service Practitioners ─── */

export interface ServicePractitionerServiceType {
  id: string
  bookingType: string
  price: number | null
  duration: number | null
  isActive: boolean
}

export interface ServicePractitioner {
  id: string // PractitionerService.id
  practitioner: {
    id: string
    nameAr: string | null
    title: string | null
    avatarUrl: string | null
    isActive: boolean
    user: {
      firstName: string
      lastName: string
    }
  }
  serviceTypes: ServicePractitionerServiceType[]
  customDuration: number | null
  bufferMinutes: number
  availableTypes: string[]
  isActive: boolean
}
