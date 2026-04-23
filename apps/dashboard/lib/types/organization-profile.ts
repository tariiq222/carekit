/**
 * Organization Profile Types — CareKit Dashboard
 */

export interface OrgProfile {
  nameAr: string
  nameEn: string | null
  slug: string
  tagline: string | null
  logoUrl: string | null
}

export interface UpdateOrgProfilePayload {
  nameAr?: string
  nameEn?: string
  slug?: string
  tagline?: string
}