import { z } from 'zod'

export const createServiceSchema = z.object({
  nameAr: z.string().min(2, 'الاسم العربي مطلوب').max(255),
  nameEn: z.string().min(2, 'الاسم الإنجليزي مطلوب').max(255),
  descriptionAr: z.string().max(500).optional().or(z.literal('')),
  descriptionEn: z.string().max(500).optional().or(z.literal('')),
  categoryId: z.string().uuid('معرف التصنيف غير صحيح'),
  price: z.coerce.number().int().min(0).optional(),
  duration: z.coerce.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
})

export const updateServiceSchema = createServiceSchema.partial()

export type CreateServiceFormValues = z.infer<typeof createServiceSchema>
export type UpdateServiceFormValues = z.infer<typeof updateServiceSchema>
