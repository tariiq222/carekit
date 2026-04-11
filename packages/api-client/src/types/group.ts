export type GroupStatus = 'active' | 'completed' | 'cancelled'

export interface GroupListItem {
  id: string
  nameAr: string
  nameEn: string
  status: GroupStatus
  maxCapacity: number
  enrolledCount: number
  startDate: string
  endDate?: string
  service: { id: string; nameAr: string }
  practitioner: { id: string; user: { firstName: string; lastName: string } }
  createdAt: string
}

export interface GroupListQuery {
  page?: number
  perPage?: number
  search?: string
  status?: string
}
