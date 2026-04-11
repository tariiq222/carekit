import { z } from 'zod'

export const createDepartmentSchema = z.object({
  nameAr: z.string().min(2, 'الاسم العربي مطلوب').max(255),
  nameEn: z.string().min(2, 'الاسم الإنجليزي مطلوب').max(255),
  descriptionAr: z.string().max(1000).optional().or(z.literal('')),
  descriptionEn: z.string().max(1000).optional().or(z.literal('')),
  icon: z.string().max(100).optional().or(z.literal('')),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const updateDepartmentSchema = createDepartmentSchema.partial()

export type CreateDepartmentFormValues = z.infer<typeof createDepartmentSchema>
export type UpdateDepartmentFormValues = z.infer<typeof updateDepartmentSchema>
