import { z } from "zod"

// ---------------------------------------------------------------------------
// Base schema — mirrors CreateCoursePayload
// ---------------------------------------------------------------------------

const baseCourseSchema = z.object({
  nameAr: z.string().min(1, "مطلوب").max(255),
  nameEn: z.string().min(1, "Required").max(255),
  descriptionAr: z.string().max(2000).optional().or(z.literal("")),
  descriptionEn: z.string().max(2000).optional().or(z.literal("")),
  practitionerId: z.string().uuid("اختر ممارساً"),
  totalSessions: z.number().int().min(1).max(52),
  durationPerSessionMin: z.number().int().min(15).max(480),
  frequency: z.enum(["weekly", "biweekly", "monthly"]),
  startDate: z.string().datetime({ message: "تاريخ غير صالح" }),
  priceHalalat: z.number().int().min(0),
  isGroup: z.boolean(),
  maxParticipants: z.number().int().min(2).optional(),
  deliveryMode: z.enum(["in_person", "online"]),
  location: z.string().max(500).optional().or(z.literal("")),
})

// ---------------------------------------------------------------------------
// Wizard step type + field map
// ---------------------------------------------------------------------------

export type CourseWizardStep = 1 | 2 | 3 | 4

export type CourseFormValues = z.infer<typeof baseCourseSchema>

export const stepFields: Record<CourseWizardStep, (keyof CourseFormValues)[]> = {
  1: ["nameAr", "nameEn", "descriptionAr", "descriptionEn", "practitionerId"],
  2: ["totalSessions", "durationPerSessionMin", "frequency", "startDate"],
  3: ["priceHalalat", "isGroup", "maxParticipants", "deliveryMode", "location"],
  4: [],
}

// ---------------------------------------------------------------------------
// Per-step schemas (for wizard step validation)
// ---------------------------------------------------------------------------

export const courseStep1Schema = baseCourseSchema.pick({
  nameAr: true,
  nameEn: true,
  descriptionAr: true,
  descriptionEn: true,
  practitionerId: true,
})

export const courseStep2Schema = baseCourseSchema.pick({
  totalSessions: true,
  durationPerSessionMin: true,
  frequency: true,
  startDate: true,
})

export const courseStep3Schema = baseCourseSchema
  .pick({
    priceHalalat: true,
    isGroup: true,
    maxParticipants: true,
    deliveryMode: true,
    location: true,
  })
  .refine(
    (data) => !data.isGroup || (data.maxParticipants !== undefined),
    { message: "الحد الأقصى للمشاركين مطلوب للدورات الجماعية", path: ["maxParticipants"] },
  )
  .refine(
    (data) =>
      data.deliveryMode !== "in_person" ||
      (!!data.location && data.location.trim().length > 0),
    { message: "الموقع مطلوب للدورات الحضورية", path: ["location"] },
  )

// ---------------------------------------------------------------------------
// Full create schema (all fields + cross-field refines)
// ---------------------------------------------------------------------------

export const createCourseSchema = baseCourseSchema
  .refine(
    (data) => !data.isGroup || (data.maxParticipants !== undefined),
    { message: "الحد الأقصى للمشاركين مطلوب للدورات الجماعية", path: ["maxParticipants"] },
  )
  .refine(
    (data) =>
      data.deliveryMode !== "in_person" ||
      (!!data.location && data.location.trim().length > 0),
    { message: "الموقع مطلوب للدورات الحضورية", path: ["location"] },
  )

// ---------------------------------------------------------------------------
// Enroll patient schema
// ---------------------------------------------------------------------------

export const enrollPatientSchema = z.object({
  patientId: z.string().uuid("اختر مستفيداً"),
})

export type EnrollPatientFormValues = z.infer<typeof enrollPatientSchema>
