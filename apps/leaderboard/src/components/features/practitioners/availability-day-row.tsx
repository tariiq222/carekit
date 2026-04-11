import { useFieldArray, type Control, type UseFormRegister, type FieldErrors } from 'react-hook-form'
import { HIcon } from '@/components/shared/hicon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { WeeklyScheduleFormValues } from '@/lib/schemas/availability.schema'

interface Props {
  index: number
  label: string
  control: Control<WeeklyScheduleFormValues>
  register: UseFormRegister<WeeklyScheduleFormValues>
  errors: FieldErrors<WeeklyScheduleFormValues>
  enabled: boolean
  onToggle: (next: boolean) => void
}

export function AvailabilityDayRow({
  index,
  label,
  control,
  register,
  errors,
  enabled,
  onToggle,
}: Props) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `days.${index}.slots`,
  })

  const dayErrors = errors.days?.[index]?.slots

  return (
    <div className="glass rounded-[var(--radius)] p-4 md:p-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onToggle(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? 'bg-[var(--primary)]' : 'bg-[var(--surface-solid)] border border-[var(--border-soft)]'
            }`}
            aria-pressed={enabled}
            aria-label={`تفعيل ${label}`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                enabled ? 'translate-x-1' : 'translate-x-6'
              }`}
            />
          </button>
          <span className="text-sm font-semibold text-[var(--fg)] min-w-[64px]">
            {label}
          </span>
        </div>

        {enabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ startTime: '09:00', endTime: '17:00' })}
          >
            <HIcon name="hgi-add-01" className="me-1" />
            إضافة فترة
          </Button>
        )}
      </div>

      {enabled && (
        <div className="mt-4 space-y-2">
          {fields.length === 0 && (
            <p className="text-xs text-[var(--muted)]">لا توجد فترات. أضف فترة لبدء الاستقبال.</p>
          )}
          {fields.map((field, slotIdx) => {
            const startErr = dayErrors?.[slotIdx]?.startTime?.message
            const endErr = dayErrors?.[slotIdx]?.endTime?.message
            return (
              <div
                key={field.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
              >
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    type="time"
                    {...register(`days.${index}.slots.${slotIdx}.startTime`)}
                    className="flex-1"
                  />
                  <span className="text-[var(--muted)] text-xs">إلى</span>
                  <Input
                    type="time"
                    {...register(`days.${index}.slots.${slotIdx}.endTime`)}
                    className="flex-1"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => remove(slotIdx)}
                  aria-label="حذف الفترة"
                >
                  <HIcon name="hgi-delete-02" />
                </Button>
                {(startErr || endErr) && (
                  <p className="text-xs text-[var(--error,#dc2626)] basis-full">
                    {endErr || startErr}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
