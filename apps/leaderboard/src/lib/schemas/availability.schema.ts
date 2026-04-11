import { z } from 'zod'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const slotSchema = z
  .object({
    startTime: z.string().regex(TIME_RE, 'تنسيق الوقت HH:mm'),
    endTime: z.string().regex(TIME_RE, 'تنسيق الوقت HH:mm'),
  })
  .refine((s) => s.startTime < s.endTime, {
    message: 'وقت البداية يجب أن يسبق النهاية',
    path: ['endTime'],
  })

const daySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  enabled: z.boolean(),
  slots: z.array(slotSchema),
})

export const weeklyScheduleSchema = z.object({
  days: z.array(daySchema).length(7),
})

export type WeeklyScheduleFormValues = z.infer<typeof weeklyScheduleSchema>
export type DayFormValues = z.infer<typeof daySchema>
export type SlotFormValues = z.infer<typeof slotSchema>
