import { z } from "zod"

/* ─── Zod Schema ─── */

export const EMPLOYEE_GENDERS = ["MALE", "FEMALE"] as const
export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT"] as const

export const createEmployeeSchema = z.object({
  title: z.string().optional(),
  nameEn: z.string().min(1, "الاسم الكامل بالإنجليزية مطلوب").max(255),
  nameAr: z.string().min(1, "الاسم الكامل بالعربية مطلوب").max(255),
  email: z.string().email("البريد الإلكتروني غير صالح"),
  phone: z.string().regex(/^\+?[0-9\s-]{7,20}$/, "رقم الجوال غير صالح").optional().or(z.literal("")),
  gender: z.enum(EMPLOYEE_GENDERS).optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  specialty: z.string().min(1, "التخصص مطلوب"),
  specialtyAr: z.string().optional(),
  bio: z.string().optional(),
  bioAr: z.string().optional(),
  experience: z.coerce.number().int().min(0).optional(),
  education: z.string().optional(),
  educationAr: z.string().optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  avatarFile: z.instanceof(File).optional(),
  branchIds: z.array(z.string()).optional(),
  serviceIds: z.array(z.string()).optional(),
  isActive: z.boolean(),
})

export type CreateEmployeeFormData = z.infer<typeof createEmployeeSchema>

/* ─── Default Values ─── */

export const createEmployeeDefaults: CreateEmployeeFormData = {
  title: "",
  nameEn: "",
  nameAr: "",
  email: "",
  phone: "",
  gender: undefined,
  employmentType: "FULL_TIME",
  specialty: "",
  specialtyAr: "",
  bio: "",
  bioAr: "",
  experience: undefined,
  education: "",
  educationAr: "",
  avatarUrl: "",
  avatarFile: undefined,
  branchIds: [],
  serviceIds: [],
  isActive: true,
}
