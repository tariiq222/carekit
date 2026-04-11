import { z } from 'zod'

export const createPractitionerSchema = z.object({
  userId: z.string().uuid('اختر مستخدماً'),
  specialtyId: z.string().uuid('اختر تخصصاً'),
  experience: z.coerce.number().min(0).max(50),
  bio: z.string().max(1000).optional().or(z.literal('')),
  bioAr: z.string().max(1000).optional().or(z.literal('')),
})

export const updatePractitionerSchema = z.object({
  specialtyId: z.string().uuid().optional(),
  experience: z.coerce.number().min(0).max(50).optional(),
  bio: z.string().max(1000).optional().or(z.literal('')),
  bioAr: z.string().max(1000).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
})

export type CreatePractitionerFormValues = z.infer<typeof createPractitionerSchema>
export type UpdatePractitionerFormValues = z.infer<typeof updatePractitionerSchema>
