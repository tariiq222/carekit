import { z } from "zod"

/* ─── OTP schema (zatca-tab) ─── */

export const zatcaOtpSchema = z.object({
  otp: z.string().min(1, "OTP is required"),
})

export type ZatcaOtpFormData = z.infer<typeof zatcaOtpSchema>
