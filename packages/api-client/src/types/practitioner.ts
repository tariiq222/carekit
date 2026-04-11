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
