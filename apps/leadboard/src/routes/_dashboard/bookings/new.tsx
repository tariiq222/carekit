import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { CreateBookingPayload } from '@carekit/api-client'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateBooking } from '@/hooks/use-bookings'
import {
  createBookingSchema,
  type CreateBookingFormValues,
} from '@/lib/schemas/booking.schema'

export const Route = createFileRoute('/_dashboard/bookings/new')({
  component: NewBookingPage,
})

function stripEmpty<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' || v === undefined || v === null) continue
    out[k] = v
  }
  return out as T
}

function NewBookingPage() {
  const navigate = useNavigate()
  const createMutation = useCreateBooking()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateBookingFormValues>({
    resolver: zodResolver(createBookingSchema),
    defaultValues: { type: 'in_person' },
  })

  const typeValue = watch('type')

  const onSubmit = (values: CreateBookingFormValues) => {
    const payload = stripEmpty(values) as unknown as CreateBookingPayload
    createMutation.mutate(payload, {
      onSuccess: () => {
        navigate({ to: '/bookings' })
      },
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="حجز جديد" description="إنشاء حجز جديد للمريض" />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="glass rounded-[var(--radius)] p-6 max-w-2xl space-y-4"
      >
        <div>
          <Label htmlFor="patientId">معرّف المريض (اختياري)</Label>
          <Input
            id="patientId"
            placeholder="UUID المريض — اتركه فارغاً لزائر"
            {...register('patientId')}
          />
          {errors.patientId && (
            <p className="text-xs text-[var(--error,#dc2626)] mt-1">
              {errors.patientId.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="practitionerId">معرّف الممارس *</Label>
          <Input
            id="practitionerId"
            placeholder="UUID الممارس"
            {...register('practitionerId')}
          />
          {errors.practitionerId && (
            <p className="text-xs text-[var(--error,#dc2626)] mt-1">
              {errors.practitionerId.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="serviceId">معرّف الخدمة *</Label>
          <Input
            id="serviceId"
            placeholder="UUID الخدمة"
            {...register('serviceId')}
          />
          {errors.serviceId && (
            <p className="text-xs text-[var(--error,#dc2626)] mt-1">
              {errors.serviceId.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="date">التاريخ *</Label>
            <Input id="date" type="date" {...register('date')} />
            {errors.date && (
              <p className="text-xs text-[var(--error,#dc2626)] mt-1">
                {errors.date.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="startTime">الوقت *</Label>
            <Input id="startTime" type="time" {...register('startTime')} />
            {errors.startTime && (
              <p className="text-xs text-[var(--error,#dc2626)] mt-1">
                {errors.startTime.message}
              </p>
            )}
          </div>
        </div>

        <div>
          <Label>النوع *</Label>
          <Select
            value={typeValue}
            onValueChange={(v) =>
              setValue('type', v as CreateBookingFormValues['type'], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="اختر النوع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in_person">حضوري</SelectItem>
              <SelectItem value="online">أونلاين</SelectItem>
              <SelectItem value="walk_in">بدون موعد</SelectItem>
            </SelectContent>
          </Select>
          {errors.type && (
            <p className="text-xs text-[var(--error,#dc2626)] mt-1">
              {errors.type.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="notes">ملاحظات</Label>
          <Input id="notes" placeholder="ملاحظات للحجز" {...register('notes')} />
          {errors.notes && (
            <p className="text-xs text-[var(--error,#dc2626)] mt-1">
              {errors.notes.message}
            </p>
          )}
        </div>

        {createMutation.error && (
          <p className="text-xs text-[var(--error,#dc2626)]">
            {(createMutation.error as Error).message ?? 'حدث خطأ أثناء الحفظ'}
          </p>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'جارٍ الحفظ...' : 'حفظ الحجز'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: '/bookings' })}
          >
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  )
}
