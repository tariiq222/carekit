export interface PractitionerAvailability {
  id: string
  practitionerId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
  branchId: string | null
  createdAt: string
  updatedAt: string
}

export interface AvailabilitySlotInput {
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive?: boolean
  branchId?: string | null
}

export interface SetAvailabilityPayload {
  schedule: AvailabilitySlotInput[]
}

export interface GetAvailabilityResponse {
  schedule: PractitionerAvailability[]
}

export interface SetAvailabilityResponse {
  success: boolean
  data: { schedule: PractitionerAvailability[] }
  message: string
}
