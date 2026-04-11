import { Link } from '@tanstack/react-router'
import { useBookings } from '@/hooks/use-bookings'
import { HIcon } from '@/components/shared/hicon'
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

function isCurrent(startTime: string): boolean {
  const now = new Date()
  let target: Date
  if (/^\d{2}:\d{2}/.test(startTime)) {
    target = new Date()
    const [h, min] = startTime.split(':').map(Number) as [number, number]
    target.setHours(h, min, 0, 0)
  } else {
    try { target = new Date(startTime) } catch { return false }
  }
  const diff = (target.getTime() - now.getTime()) / 60000
  return diff >= -5 && diff <= 15
}

function dotClass(status: BookingListItem['status']): string {
  switch (status) {
    case 'confirmed':
    case 'completed':
      return 'w-2.5 h-2.5 rounded-full bg-[var(--success)]'
    case 'pending':
      return 'w-2.5 h-2.5 rounded-full bg-[var(--warning)]'
    case 'cancelled':
      return 'w-2.5 h-2.5 rounded-full bg-[#98A2B3]'
    default:
      return 'w-2.5 h-2.5 rounded-full bg-[var(--primary)] ring-2 ring-[color:var(--primary)]/25'
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
        <div className="flex items-center gap-2">
          <Link
            to="/bookings"
            className="text-xs font-medium text-[var(--primary)] hover:underline"
          >
            عرض الكل
          </Link>
          <Link
            to="/bookings/new"
            className="text-xs font-semibold text-white bg-[var(--primary)] px-3 py-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--primary-dark)] transition-colors"
          >
            <HIcon name="hgi-add-01" size={16} className="ml-1" />
            حجز جديد
          </Link>
        </div>
      </header>

      {isLoading ? (
        <div className="flex flex-col">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4 py-3">
              <div className="w-14 h-4 rounded bg-[var(--border-soft)] animate-pulse shrink-0" />
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--border-soft)] animate-pulse shrink-0 mt-1" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-4 w-2/3 rounded bg-[var(--border-soft)] animate-pulse" />
                <div className="h-3 w-1/2 rounded bg-[var(--border-soft)] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : data?.items && data.items.length > 0 ? (
        <ol className="flex flex-col">
          {data.items.map((b, idx) => (
            <li
              key={b.id}
              className="flex items-start gap-4 py-3 border-b border-[var(--border-soft)] last:border-b-0"
            >
              <div className="w-14 shrink-0 tabular-nums pt-0.5">
                {isCurrent(b.startTime) ? (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--primary)] text-white">
                    {formatTime(b.startTime)}
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-[var(--fg-2)]">
                    {formatTime(b.startTime)}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-center shrink-0 pt-2">
                <div className={dotClass(b.status)} />
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
        <div className="text-center py-12 text-sm text-[var(--muted)]">
          <HIcon name="hgi-calendar-remove-02" size={24} className="mb-3 block opacity-50" />
          <p className="font-medium">لا توجد حجوزات اليوم</p>
          <p className="text-[11px] mt-1 opacity-70">ستظهر حجوزات اليوم هنا فور إنشائها</p>
        </div>
      )}
    </section>
  )
}
