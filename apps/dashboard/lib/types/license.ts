/**
 * License Types — CareKit Dashboard
 */

export interface LicenseConfig {
  id: string
  hasCoupons: boolean
  hasIntakeForms: boolean
  hasChatbot: boolean
  hasRatings: boolean
  hasMultiBranch: boolean
  hasReports: boolean
  hasRecurring: boolean
  hasWalkIn: boolean
  hasWaitlist: boolean
  hasZoom: boolean
  hasZatca: boolean
  hasDepartments: boolean
  hasGroups: boolean
  createdAt: string
  updatedAt: string
}

export type UpdateLicensePayload = Partial<
  Omit<LicenseConfig, "id" | "createdAt" | "updatedAt">
>

export interface FeatureWithStatus {
  key: string
  licensed: boolean
  enabled: boolean
  nameAr: string
  nameEn: string
}
