import { z } from 'zod'

export const createBranchSchema = z.object({
  nameAr: z.string().min(2, 'الاسم العربي مطلوب').max(255),
  nameEn: z.string().min(2, 'الاسم الإنجليزي مطلوب').max(255),
  address: z.string().max(500).optional().or(z.literal('')),
  phone: z
    .string()
    .regex(/^\+?[0-9]{9,15}$/, 'رقم هاتف غير صحيح')
    .optional()
    .or(z.literal('')),
  email: z.string().email('بريد إلكتروني غير صحيح').optional().or(z.literal('')),
  isMain: z.boolean().optional(),
  isActive: z.boolean().optional(),
  timezone: z.string().max(50).optional().or(z.literal('')),
})

export const updateBranchSchema = createBranchSchema.partial()

export type CreateBranchFormValues = z.infer<typeof createBranchSchema>
export type UpdateBranchFormValues = z.infer<typeof updateBranchSchema>
