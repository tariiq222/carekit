import { z } from "zod"

/* ─── Zod Schema ─── */

export const createEmployeeSchema = z.object({
  title: z.string().optional(),
  nameEn: z.string().min(1, "الاسم الكامل بالإنجليزية مطلوب").max(255),
  nameAr: z.string().min(1, "الاسم الكامل بالعربية مطلوب").max(255),
  email: z.string().email("البريد الإلكتروني غير صالح"),
  specialty: z.string().min(1, "التخصص مطلوب"),
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

export type CreateEmployeeFormData = z.infer<typeof createEmployeeSchema>

/* ─── Default Values ─── */

export const createEmployeeDefaults: CreateEmployeeFormData = {
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
