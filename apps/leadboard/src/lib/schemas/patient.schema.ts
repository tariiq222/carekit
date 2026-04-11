import { z } from 'zod'

export const createWalkInSchema = z.object({
  firstName: z.string().min(2, 'الاسم الأول مطلوب'),
  lastName: z.string().min(2, 'اسم العائلة مطلوب'),
  phone: z
    .string()
    .regex(/^\+?[0-9]{9,15}$/, 'رقم هاتف غير صحيح')
    .optional()
    .or(z.literal('')),
  gender: z.enum(['male', 'female']).optional(),
  dateOfBirth: z.string().optional().or(z.literal('')),
})

export const updatePatientSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  phone: z
    .string()
    .regex(/^\+?[0-9]{9,15}$/, 'رقم هاتف غير صحيح')
    .optional()
    .or(z.literal('')),
  email: z.string().email('بريد إلكتروني غير صحيح').optional().or(z.literal('')),
  gender: z.enum(['male', 'female']).optional(),
  dateOfBirth: z.string().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
})

export type CreateWalkInFormValues = z.infer<typeof createWalkInSchema>
export type UpdatePatientFormValues = z.infer<typeof updatePatientSchema>
