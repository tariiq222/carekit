/**
 * ZATCA Types — CareKit Dashboard
 */

export interface ZatcaConfig {
  id: string
  vatRegistrationNumber: string | null
  sellerName: string | null
  environment: string
  isOnboarded: boolean
  onboardedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ZatcaOnboardPayload {
  vatRegistrationNumber: string
  sellerName: string
}
