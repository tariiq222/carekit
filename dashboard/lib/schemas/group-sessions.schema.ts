import { z } from "zod"

const baseSessionSchema = z.object({
  nameAr: z.string().min(1, "مطلوب").max(255),
  nameEn: z.string().min(1, "Required").max(255),
  descriptionAr: z.string().max(2000).optional(),
  descriptionEn: z.string().max(2000).optional(),
  practitionerId: z.string().uuid("اختر ممارساً"),
  minParticipants: z.number().int().min(1),
  maxParticipants: z.number().int().min(1),
  pricePerPersonHalalat: z.number().int().min(0),
  durationMinutes: z.number().int().min(1),
  paymentDeadlineHours: z.number().int().min(1).max(168).optional(),
  schedulingMode: z.enum(["fixed_date", "on_capacity"]),
  startTime: z.string().datetime().optional(),
  isPublished: z.boolean().optional(),
  expiresAt: z.string().datetime().optional(),
})

export const createGroupSessionSchema = baseSessionSchema
  .refine(
    (data) => data.minParticipants <= data.maxParticipants,
    { message: "الحد الأدنى لا يمكن أن يتجاوز الحد الأقصى", path: ["minParticipants"] },
  )
  .refine(
    (data) => data.schedulingMode !== "fixed_date" || !!data.startTime,
    { message: "تاريخ البدء مطلوب عند تحديد تاريخ", path: ["startTime"] },
  )

export const sessionStepInfoSchema = baseSessionSchema.pick({
  nameAr: true,
  nameEn: true,
  descriptionAr: true,
  descriptionEn: true,
  practitionerId: true,
})

export const sessionStepSettingsSchema = baseSessionSchema.pick({
  minParticipants: true,
  maxParticipants: true,
  pricePerPersonHalalat: true,
  durationMinutes: true,
  paymentDeadlineHours: true,
})

export const sessionStepSchedulingSchema = baseSessionSchema.pick({
  schedulingMode: true,
  startTime: true,
  isPublished: true,
  expiresAt: true,
})

export const setDateSchema = z.object({
  startTime: z.string().datetime({ message: "تاريخ غير صالح" }),
})

export type CreateGroupSessionFormValues = z.infer<typeof createGroupSessionSchema>
export type SetDateFormValues = z.infer<typeof setDateSchema>

export type SessionWizardStep = 1 | 2 | 3 | 4

export const stepFields: Record<SessionWizardStep, (keyof CreateGroupSessionFormValues)[]> = {
  1: ["nameAr", "nameEn", "descriptionAr", "descriptionEn", "practitionerId"],
  2: ["minParticipants", "maxParticipants", "pricePerPersonHalalat", "durationMinutes", "paymentDeadlineHours"],
  3: ["schedulingMode", "startTime", "isPublished", "expiresAt"],
  4: [],
}
