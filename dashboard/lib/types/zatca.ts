/**
 * ZATCA Types — CareKit Dashboard
 */

export interface ZatcaConfig {
  vatNumber: string | null
  organizationName: string | null
  hasComplianceCsid: boolean
  hasProductionCsid: boolean
  phase: "none" | "compliance" | "production"
}

export interface OnboardingStatus {
  phase: string
  hasComplianceCsid: boolean
  hasProductionCsid: boolean
  complianceCsidExpiry: string | null
  productionCsidExpiry: string | null
}

export interface SandboxStats {
  totalReported: number
  accepted: number
  rejected: number
  warnings: number
  pending: number
}

export interface ZatcaOnboardPayload {
  otp: string
}
