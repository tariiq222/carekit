import { z } from "zod"

export const createOfferingSchema = z.object({
  nameAr: z.string().min(1, "مطلوب").max(255),
  nameEn: z.string().min(1, "Required").max(255),
  descriptionAr: z.string().max(2000).optional(),
  descriptionEn: z.string().max(2000).optional(),
  practitionerId: z.string().uuid("اختر ممارساً"),
  minParticipants: z.number().int().min(1),
  maxParticipants: z.number().int().min(1),
  pricePerPersonHalalat: z.number().int().min(0),
  durationMin: z.number().int().min(1),
  paymentDeadlineHours: z.number().int().min(1).max(168).optional(),
}).refine(
  (data) => data.minParticipants <= data.maxParticipants,
  { message: "الحد الأدنى لا يمكن أن يتجاوز الحد الأقصى", path: ["minParticipants"] },
)

export const createSessionSchema = z.object({
  startTime: z.string().datetime(),
  registrationDeadline: z.string().datetime(),
}).refine(
  (data) => new Date(data.registrationDeadline) < new Date(data.startTime),
  { message: "آخر موعد للتسجيل يجب أن يكون قبل وقت الجلسة", path: ["registrationDeadline"] },
)

export type CreateOfferingFormValues = z.infer<typeof createOfferingSchema>
export type CreateSessionFormValues = z.infer<typeof createSessionSchema>
