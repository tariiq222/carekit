import { z } from "zod"

export const registerSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  email: z.string().email("بريد إلكتروني غير صحيح"),
  phone: z.string().min(9, "رقم جوال غير صحيح"),
  password: z
    .string()
    .min(8, "كلمة المرور 8 أحرف على الأقل")
    .regex(/[A-Z]/, "يجب أن تحتوي على حرف كبير")
    .regex(/[0-9]/, "يجب أن تحتوي على رقم"),
  businessNameAr: z.string().min(2, "اسم النشاط مطلوب"),
  businessNameEn: z.string().optional(),
})

export type RegisterFormValues = z.infer<typeof registerSchema>
