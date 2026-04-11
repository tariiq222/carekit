import { Link } from '@tanstack/react-router'
import { useBookings } from '@/hooks/use-bookings'
import { BookingStatusBadge } from '@/components/features/bookings/booking-status-badge'
import type { BookingListItem } from '@carekit/api-client'

function todayIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatTime(value: string) {
  // Backend returns "HH:mm" or ISO — handle both.
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5)
  try {
    return new Date(value).toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

function patientName(b: BookingListItem) {
  if (!b.patient) return 'بدون موعد'
  return `${b.patient.firstName} ${b.patient.lastName}`.trim()
}

function practitionerName(b: BookingListItem) {
  const u = b.practitioner.user
  return `${u.firstName} ${u.lastName}`.trim()
}

export function OverviewTimeline() {
  const today = todayIso()
  const { data, isLoading } = useBookings({
    dateFrom: today,
    dateTo: today,
    page: 1,
    perPage: 20,
  })

  return (
    <section className="glass rounded-[var(--radius)] p-5 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[var(--fg)]">جدول اليوم</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {data?.meta?.total ?? 0} حجز
          </p>
        </div>
        <Link
          to="/bookings"
          className="text-xs font-medium text-[var(--primary)] hover:underline"
        >
          عرض الكل
        </Link>
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-[var(--radius-sm)] bg-[var(--surface)] animate-pulse" />
          ))}
        </div>
      ) : data?.items && data.items.length > 0 ? (
        <ol className="flex flex-col">
          {data.items.map((b, idx) => (
            <li
              key={b.id}
              className="flex items-start gap-4 py-3 border-b border-[var(--border-soft)] last:border-b-0"
            >
              <div className="w-14 flex-shrink-0 text-sm font-semibold text-[var(--fg-2)] tabular-nums pt-0.5">
                {formatTime(b.startTime)}
              </div>
              <div className="relative flex flex-col items-center flex-shrink-0 pt-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--primary)]" />
                {idx < data.items.length - 1 && (
                  <div className="w-px flex-1 bg-[var(--border-soft)] mt-1" style={{ minHeight: 28 }} />
                )}
              </div>
              <Link
                to="/bookings/$id"
                params={{ id: b.id }}
                className="flex-1 min-w-0 group"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-[var(--fg)] group-hover:text-[var(--primary)] transition-colors">
                    {patientName(b)}
                  </span>
                  <BookingStatusBadge status={b.status} />
                </div>
                <p className="text-xs text-[var(--muted)] mt-1 truncate">
                  {b.service.nameAr} · {practitionerName(b)}
                  {b.bookedPrice != null && ` · ${b.bookedPrice} ر.س`}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="text-center py-10 text-sm text-[var(--muted)]">
          <i className="hgi hgi-calendar-remove-02 text-3xl mb-2 block opacity-60" />
          لا توجد حجوزات اليوم
        </div>
      )}
    </section>
  )
}
