import { z } from 'zod'

export const createBookingSchema = z.object({
  practitionerId: z.string().uuid('اختر ممارساً'),
  serviceId: z.string().uuid('اختر خدمة'),
  type: z.enum(['in_person', 'online', 'walk_in']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'تاريخ غير صحيح'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'وقت غير صحيح'),
  patientId: z.string().uuid().optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  branchId: z.string().uuid().optional().or(z.literal('')),
})

export const updateBookingSchema = z.object({
  adminNotes: z.string().max(500).optional().or(z.literal('')),
})

export type CreateBookingFormValues = z.infer<typeof createBookingSchema>
export type UpdateBookingFormValues = z.infer<typeof updateBookingSchema>
