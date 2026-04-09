import { z } from "zod"

export const createGroupSessionSchema = z.object({
  nameAr: z.string().min(1, "مطلوب").max(255),
  nameEn: z.string().min(1, "Required").max(255),
  descriptionAr: z.string().max(2000).optional(),
  descriptionEn: z.string().max(2000).optional(),
  practitionerId: z.string().uuid("اختر ممارساً"),
  departmentId: z.string().uuid().optional(),
  minParticipants: z.number().int().min(1),
  maxParticipants: z.number().int().min(1),
  pricePerPersonHalalat: z.number().int().min(0),
  durationMinutes: z.number().int().min(1),
  paymentDeadlineHours: z.number().int().min(1).max(168).optional(),
  schedulingMode: z.enum(["fixed_date", "on_capacity"]),
  startTime: z.string().datetime().optional(),
  isPublished: z.boolean().optional(),
  expiresAt: z.string().datetime().optional(),
}).refine(
  (data) => data.minParticipants <= data.maxParticipants,
  { message: "الحد الأدنى لا يمكن أن يتجاوز الحد الأقصى", path: ["minParticipants"] },
).refine(
  (data) => data.schedulingMode !== "fixed_date" || !!data.startTime,
  { message: "تاريخ البدء مطلوب عند تحديد تاريخ", path: ["startTime"] },
)

export const setDateSchema = z.object({
  startTime: z.string().datetime({ message: "تاريخ غير صالح" }),
})

export type CreateGroupSessionFormValues = z.infer<typeof createGroupSessionSchema>
export type SetDateFormValues = z.infer<typeof setDateSchema>
