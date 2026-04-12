import { z } from "zod"

/* ─── ZATCA onboarding form ─── */

export const zatcaOnboardSchema = z.object({
  vatRegistrationNumber: z.string().min(1, "VAT registration number is required"),
  sellerName: z.string().min(1, "Seller name is required"),
})

export type ZatcaOnboardFormData = z.infer<typeof zatcaOnboardSchema>

// Keep alias for any existing references
export const zatcaOtpSchema = zatcaOnboardSchema
export type ZatcaOtpFormData = ZatcaOnboardFormData
