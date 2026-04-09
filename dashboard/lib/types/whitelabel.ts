/**
 * WhiteLabel Types — CareKit Dashboard
 * Structured singleton (no longer EAV key-value)
 */

export interface WhiteLabelConfig {
  id: string
  systemName: string
  systemNameAr: string
  logoUrl: string | null
  faviconUrl: string | null
  primaryColor: string
  secondaryColor: string
  fontFamily: string
  domain: string
  clinicCanEdit: boolean
  createdAt: string
  updatedAt: string
}

export type UpdateWhitelabelPayload = Partial<
  Omit<WhiteLabelConfig, "id" | "createdAt" | "updatedAt">
>

export interface PublicBranding {
  systemName: string
  systemNameAr: string
  logoUrl: string | null
  faviconUrl: string | null
  primaryColor: string
  secondaryColor: string
}
