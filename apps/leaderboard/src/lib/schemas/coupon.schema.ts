import { z } from 'zod'

const codeRegex = /^[A-Z0-9_-]+$/i

export const couponFormSchema = z.object({
  code: z
    .string()
    .min(3, 'الكود قصير جدًا')
    .max(20, 'الكود طويل جدًا')
    .regex(codeRegex, 'يسمح فقط بالحروف والأرقام والشرطات'),
  descriptionAr: z.string().optional().or(z.literal('')),
  descriptionEn: z.string().optional().or(z.literal('')),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.coerce.number().int().min(1, 'القيمة مطلوبة'),
  minAmount: z.coerce.number().int().min(0).optional(),
  maxUses: z.coerce.number().int().min(1).optional().or(z.nan()),
  maxUsesPerUser: z.coerce.number().int().min(1).optional().or(z.nan()),
  expiresAt: z.string().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
})

export type CouponFormValues = z.infer<typeof couponFormSchema>
