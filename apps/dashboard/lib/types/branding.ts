/**
 * Branding Types — CareKit Dashboard
 */

export interface BrandingConfig {
  id: string
  // Identity
  systemName:        string
  systemNameAr:      string
  productTagline:    string | null
  // Assets
  logoUrl:           string | null
  faviconUrl:        string | null
  // Colors
  colorPrimary:      string
  colorPrimaryLight: string
  colorPrimaryDark:  string
  colorAccent:       string
  colorAccentDark:   string
  colorBackground:   string
  // Typography
  fontFamily:        string
  fontUrl:           string | null
  // SaaS config
  domain:            string
  clinicCanEdit:     boolean
  createdAt:         string
  updatedAt:         string
}

export type PublicBranding = Omit<BrandingConfig, "id" | "domain" | "clinicCanEdit" | "createdAt" | "updatedAt">

export type UpdateBrandingPayload = Partial<Omit<BrandingConfig, "id" | "createdAt" | "updatedAt">>
