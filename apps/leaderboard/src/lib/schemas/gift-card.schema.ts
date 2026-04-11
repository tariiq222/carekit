import { z } from 'zod'

const codeRegex = /^[A-Z0-9-]+$/i

export const giftCardFormSchema = z.object({
  code: z
    .string()
    .min(3, 'الكود قصير جدًا')
    .max(20, 'الكود طويل جدًا')
    .regex(codeRegex, 'يسمح فقط بالحروف والأرقام والشرطات')
    .optional()
    .or(z.literal('')),
  initialAmount: z.coerce
    .number()
    .int()
    .min(1, 'القيمة مطلوبة (بالهللات)'),
  expiresAt: z.string().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
})

export type GiftCardFormValues = z.infer<typeof giftCardFormSchema>
