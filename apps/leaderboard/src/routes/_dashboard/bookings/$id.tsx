import { createFileRoute, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { UpdateBookingPayload } from '@carekit/api-client'
import { PageHeader } from '@/components/shared/page-header'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useBooking, useUpdateBooking } from '@/hooks/use-bookings'
import { BookingStatusBadge } from '@/components/features/bookings/booking-status-badge'
import {
  updateBookingSchema,
  type UpdateBookingFormValues,
} from '@/lib/schemas/booking.schema'

export const Route = createFileRoute('/_dashboard/bookings/$id')({
  component: BookingDetailPage,
})

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

function BookingDetailPage() {
  const { id } = Route.useParams()
  const { data: booking, isLoading } = useBooking(id)
  const updateMutation = useUpdateBooking(id)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateBookingFormValues>({
    resolver: zodResolver(updateBookingSchema),
    values: { adminNotes: booking?.adminNotes ?? '' },
  })

  if (isLoading) return <SkeletonPage />
  if (!booking)
    return <p className="text-[var(--muted)] p-6">الحجز غير موجود</p>

  const onSubmit = (values: UpdateBookingFormValues) => {
    const payload: UpdateBookingPayload = {
      adminNotes: values.adminNotes === '' ? undefined : values.adminNotes,
    }
    updateMutation.mutate(payload)
  }

  const formattedDate = formatDate(booking.date)
  const patientName = booking.patient
    ? `${booking.patient.firstName} ${booking.patient.lastName}`
    : 'زائر'
  const practitionerName = `${booking.practitioner.user.firstName} ${booking.practitioner.user.lastName}`

  return (
    <div className="space-y-6">
      <PageHeader
        title={`حجز — ${formattedDate}`}
        description={`${booking.startTime} · ${booking.service.nameAr}`}
        actions={
          <Link to="/bookings">
            <Button variant="outline">رجوع</Button>
          </Link>
        }
      />

      <div className="glass rounded-[var(--radius)] p-6 max-w-2xl space-y-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--muted)]">الحالة:</span>
          <BookingStatusBadge status={booking.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-[var(--muted)] mb-1">المريض</p>
            <p className="text-[var(--fg)]">{patientName}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)] mb-1">الممارس</p>
            <p className="text-[var(--fg)]">{practitionerName}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)] mb-1">الخدمة</p>
            <p className="text-[var(--fg)]">{booking.service.nameAr}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)] mb-1">السعر</p>
            <p className="text-[var(--fg)]">
              {booking.bookedPrice != null
                ? `${booking.bookedPrice} ر.س`
                : '—'}
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="pt-6 border-t border-[var(--border-soft)] space-y-4"
        >
          <div>
            <Label htmlFor="adminNotes">ملاحظات إدارية</Label>
            <Input
              id="adminNotes"
              placeholder="ملاحظات داخلية حول الحجز"
              {...register('adminNotes')}
            />
            {errors.adminNotes && (
              <p className="text-xs text-[var(--error,#dc2626)] mt-1">
                {errors.adminNotes.message}
              </p>
            )}
          </div>

          {updateMutation.error && (
            <p className="text-xs text-[var(--error,#dc2626)]">
              {(updateMutation.error as Error).message ?? 'حدث خطأ أثناء الحفظ'}
            </p>
          )}

          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'جارٍ الحفظ...' : 'حفظ الملاحظات'}
          </Button>
        </form>
      </div>
    </div>
  )
}
