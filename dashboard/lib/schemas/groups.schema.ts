import { z } from "zod"

const baseGroupSchema = z.object({
  nameAr: z.string().min(1, "مطلوب").max(255),
  nameEn: z.string().min(1, "Required").max(255),
  descriptionAr: z.string().max(1000).optional(),
  descriptionEn: z.string().max(1000).optional(),
  practitionerId: z.string().uuid("اختر ممارساً"),
  minParticipants: z.number().int().min(1),
  maxParticipants: z.number().int().min(1),
  pricePerPersonHalalat: z.number().int().min(0),
  durationMinutes: z.number().int().min(1),
  paymentDeadlineHours: z.number().int().min(1).max(168).optional(),
  paymentType: z.enum(["FREE_HOLD", "DEPOSIT", "FULL_PAYMENT"]),
  depositAmount: z.number().int().min(0).optional(),
  remainingDueDate: z.string().datetime().optional(),
  schedulingMode: z.enum(["fixed_date", "on_capacity"]),
  startTime: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  deliveryMode: z.enum(["in_person", "online"]),
  location: z.string().max(500).optional(),
  meetingLink: z.string().max(500).optional(),
  isPublished: z.boolean().optional(),
  expiresAt: z.string().datetime().optional(),
})

export const createGroupSchema = baseGroupSchema
  .refine(
    (data) => data.minParticipants <= data.maxParticipants,
    { message: "الحد الأدنى لا يمكن أن يتجاوز الحد الأقصى", path: ["minParticipants"] },
  )
  .refine(
    (data) => data.schedulingMode !== "fixed_date" || !!data.startTime,
    { message: "تاريخ البدء مطلوب عند تحديد تاريخ", path: ["startTime"] },
  )
  .refine(
    (data) => data.paymentType !== "DEPOSIT" || (data.depositAmount !== undefined && data.depositAmount > 0),
    { message: "مبلغ العربون مطلوب عند اختيار نوع الدفع عربون", path: ["depositAmount"] },
  )
  .refine(
    (data) => data.paymentType !== "DEPOSIT" || !!data.remainingDueDate,
    { message: "تاريخ استحقاق المبلغ المتبقي مطلوب عند اختيار عربون", path: ["remainingDueDate"] },
  )

export type CreateGroupFormValues = z.infer<typeof createGroupSchema>

export const createGroupDefaults: Partial<CreateGroupFormValues> = {
  minParticipants: 2,
  maxParticipants: 10,
  pricePerPersonHalalat: 0,
  durationMinutes: 60,
  paymentDeadlineHours: 48,
  paymentType: "FULL_PAYMENT",
  schedulingMode: "fixed_date",
  deliveryMode: "in_person",
  isPublished: false,
}
