import { useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PageHeader } from '@/components/shared/page-header'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { usePractitioner } from '@/hooks/use-practitioners'
import {
  usePractitionerAvailability,
  useUpdatePractitionerAvailability,
} from '@/hooks/use-availability'
import {
  weeklyScheduleSchema,
  type WeeklyScheduleFormValues,
} from '@/lib/schemas/availability.schema'
import { AvailabilityDayRow } from '@/components/features/practitioners/availability-day-row'
import type {
  PractitionerAvailability,
  AvailabilitySlotInput,
} from '@carekit/api-client'

export const Route = createFileRoute('/_dashboard/practitioners/$id/availability')({
  component: PractitionerAvailabilityPage,
})

const DAY_LABELS = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
] as const

function buildDefaults(
  schedule: PractitionerAvailability[] | undefined,
): WeeklyScheduleFormValues {
  const days = Array.from({ length: 7 }, (_, dayOfWeek) => {
    const slots = (schedule ?? [])
      .filter((s) => s.dayOfWeek === dayOfWeek && s.isActive)
      .map((s) => ({ startTime: s.startTime, endTime: s.endTime }))
    return {
      dayOfWeek,
      enabled: slots.length > 0,
      slots,
    }
  })
  return { days }
}

function PractitionerAvailabilityPage() {
  const { id } = Route.useParams()
  const { data: practitioner, isLoading: pLoading } = usePractitioner(id)
  const { data: schedule, isLoading: sLoading } = usePractitionerAvailability(id)
  const updateAvailability = useUpdatePractitionerAvailability(id)

  const defaults = useMemo(() => buildDefaults(schedule), [schedule])

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<WeeklyScheduleFormValues>({
    resolver: zodResolver(weeklyScheduleSchema),
    values: defaults,
  })

  if (pLoading || sLoading) return <SkeletonPage />
  if (!practitioner) {
    return <p className="text-[var(--muted)] p-6">الممارس غير موجود</p>
  }

  const fullName = `${practitioner.user.firstName} ${practitioner.user.lastName}`

  const onSubmit = handleSubmit(async (values) => {
    const payload: AvailabilitySlotInput[] = []
    for (const day of values.days) {
      if (!day.enabled) continue
      for (const slot of day.slots) {
        payload.push({
          dayOfWeek: day.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isActive: true,
        })
      }
    }
    if (payload.length === 0) {
      alert('فعّل يوماً واحداً على الأقل وأضف فترة')
      return
    }
    await updateAvailability.mutateAsync({ schedule: payload })
  })

  const watchedDays = watch('days')

  return (
    <div className="space-y-6">
      <PageHeader
        title="جدول التوفر"
        description={`${fullName} · حدد ساعات العمل الأسبوعية`}
        actions={
          <Link to="/practitioners/$id" params={{ id }}>
            <Button variant="outline">رجوع</Button>
          </Link>
        }
      />

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-3">
          {DAY_LABELS.map((label, idx) => (
            <AvailabilityDayRow
              key={idx}
              index={idx}
              label={label}
              control={control}
              register={register}
              errors={errors}
              enabled={watchedDays?.[idx]?.enabled ?? false}
              onToggle={(next) => {
                setValue(`days.${idx}.enabled`, next, { shouldDirty: true })
                if (next && (watchedDays?.[idx]?.slots.length ?? 0) === 0) {
                  setValue(
                    `days.${idx}.slots`,
                    [{ startTime: '09:00', endTime: '17:00' }],
                    { shouldDirty: true },
                  )
                }
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            <i className="hgi hgi-tick-02 me-1" />
            حفظ الجدول
          </Button>
          {updateAvailability.isError && (
            <span className="text-xs text-[var(--error,#dc2626)]">
              تعذر حفظ الجدول
            </span>
          )}
          {updateAvailability.isSuccess && (
            <span className="text-xs text-[var(--success,#16a34a)]">
              تم الحفظ
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
