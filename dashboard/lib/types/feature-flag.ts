/**
 * Feature Flag Types — CareKit Dashboard
 */

export interface FeatureFlag {
  id: string
  key: string
  enabled: boolean
  nameAr: string
  nameEn: string
  descriptionAr: string | null
  descriptionEn: string | null
  createdAt: string
  updatedAt: string
}

/** Map of feature key → enabled status */
export type FeatureFlagMap = Record<string, boolean>
