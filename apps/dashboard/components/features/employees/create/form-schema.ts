import { z } from "zod"

/* ─── Zod Schema ─── */

export const createPractitionerSchema = z.object({
  title: z.string().optional(),
  nameEn: z.string().min(1, "Full name (EN) is required").max(255),
  nameAr: z.string().min(1, "الاسم الكامل مطلوب").max(255),
  email: z.string().email("البريد الإلكتروني غير صالح"),
  specialty: z.string().min(1, "Specialty is required"),
  specialtyAr: z.string().optional(),
  bio: z.string().optional(),
  bioAr: z.string().optional(),
  experience: z.coerce.number().int().min(0).optional(),
  education: z.string().optional(),
  educationAr: z.string().optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  avatarFile: z.instanceof(File).optional(),
  isActive: z.boolean(),
})

export type CreatePractitionerFormData = z.infer<typeof createPractitionerSchema>

/* ─── Default Values ─── */

export const createPractitionerDefaults: CreatePractitionerFormData = {
  title: "",
  nameEn: "",
  nameAr: "",
  email: "",
  specialty: "",
  specialtyAr: "",
  bio: "",
  bioAr: "",
  experience: undefined,
  education: "",
  educationAr: "",
  avatarUrl: "",
  avatarFile: undefined,
  isActive: true,
}
