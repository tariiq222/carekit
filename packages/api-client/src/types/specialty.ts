export interface SpecialtyListItem {
  id: string
  nameAr: string
  nameEn: string
  descriptionAr: string | null
  descriptionEn: string | null
  iconUrl: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
}

export interface CreateSpecialtyPayload {
  nameAr: string
  nameEn: string
  descriptionAr?: string
  descriptionEn?: string
  iconUrl?: string
  sortOrder?: number
}

export interface UpdateSpecialtyPayload {
  nameAr?: string
  nameEn?: string
  descriptionAr?: string
  descriptionEn?: string
  iconUrl?: string
  sortOrder?: number
  isActive?: boolean
}
