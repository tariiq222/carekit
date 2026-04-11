import { z } from 'zod'

export const createSpecialtySchema = z.object({
  nameAr: z.string().min(2, 'الاسم العربي مطلوب'),
  nameEn: z.string().min(2, 'الاسم الإنجليزي مطلوب'),
  descriptionAr: z.string().optional().or(z.literal('')),
  descriptionEn: z.string().optional().or(z.literal('')),
  iconUrl: z.string().url('رابط غير صحيح').optional().or(z.literal('')),
  sortOrder: z.coerce.number().int().min(0).optional(),
})

export const updateSpecialtySchema = createSpecialtySchema.partial().extend({
  isActive: z.boolean().optional(),
})

export type CreateSpecialtyFormValues = z.infer<typeof createSpecialtySchema>
export type UpdateSpecialtyFormValues = z.infer<typeof updateSpecialtySchema>
