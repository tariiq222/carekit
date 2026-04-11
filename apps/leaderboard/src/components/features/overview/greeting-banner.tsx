import { useBookingStats } from '@/hooks/use-bookings'
import { useAuthStore } from '@/lib/stores/auth.store'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour <= 11) return 'صباح الخير'
  if (hour >= 12 && hour <= 16) return 'مساء الخير'
  return 'مساء النور'
}

export function GreetingBanner() {
  const user = useAuthStore((s) => s.user)
  const { data: stats, isLoading } = useBookingStats()

  const name = user?.nameAr || user?.name || 'بك'
  const todayDate = new Date().toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  if (isLoading) {
    return (
      <div className="glass rounded-[var(--radius)] p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex flex-col gap-2">
            <div className="h-7 w-48 rounded-[var(--radius-sm)] bg-[var(--border-soft)] animate-pulse" />
            <div className="h-4 w-64 rounded-[var(--radius-sm)] bg-[var(--border-soft)] animate-pulse" />
          </div>
          <div className="flex gap-3">
            <div className="h-7 w-28 rounded-full bg-[var(--border-soft)] animate-pulse" />
            <div className="h-7 w-20 rounded-full bg-[var(--border-soft)] animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  const todayCount = stats?.today ?? 0
  const pendingCount = stats?.pending ?? 0

  return (
    <div className="glass rounded-[var(--radius)] p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--fg)]">
            {getGreeting()}، {name}
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {todayDate} · {todayCount} حجزاً اليوم
          </p>
        </div>
        <div className="flex gap-3">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[var(--primary-ultra)] text-[var(--primary)]">
            حجوزات اليوم: {todayCount}
          </span>
          {pendingCount > 0 && (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[var(--warning-bg)] text-[var(--warning)]">
              معلقة: {pendingCount}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
