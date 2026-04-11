import type { PaginatedResponse, PaginationParams } from './api.js'

export interface PatientListItem {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  dateOfBirth: string | null
  gender: 'male' | 'female' | null
  isActive: boolean
  isWalkIn: boolean
  totalBookings: number
  createdAt: string
}

export interface PatientStats {
  total: number
  active: number
  walkIn: number
  newThisWeek: number
}

export interface PatientListQuery extends PaginationParams {
  isActive?: boolean
  isWalkIn?: boolean
}

export interface CreateWalkInPayload {
  firstName: string
  lastName: string
  phone?: string
  gender?: 'male' | 'female'
  dateOfBirth?: string
}

export interface UpdatePatientPayload {
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  gender?: 'male' | 'female'
  dateOfBirth?: string
  isActive?: boolean
}

export type PatientListResponse = PaginatedResponse<PatientListItem>
