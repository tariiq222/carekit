import { useBookingStats } from '@/hooks/use-bookings'
import { usePatientStats } from '@/hooks/use-patients'
import { useAuthStore } from '@/lib/stores/auth.store'

interface StatCard {
  label: string
  value: string | number
  icon: string
  variant: 'primary' | 'success' | 'warning' | 'accent'
  sub?: string
}

const variantStyles: Record<StatCard['variant'], string> = {
  primary: 'bg-[var(--primary-ultra)] text-[var(--primary)]',
  success: 'bg-[var(--success-bg)] text-[var(--success)]',
  warning: 'bg-[var(--warning-bg)] text-[var(--warning)]',
  accent:  'bg-[var(--accent-ultra)] text-[var(--accent-dark)]',
}

function StatCardView({ card }: { card: StatCard }) {
  return (
    <div className="glass rounded-[var(--radius)] p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div
          className={[
            'w-11 h-11 rounded-[var(--radius-sm)] flex items-center justify-center',
            variantStyles[card.variant],
          ].join(' ')}
        >
          <i className={`hgi ${card.icon} text-lg`} />
        </div>
      </div>
      <div>
        <p className="text-[28px] font-extrabold leading-none text-[var(--fg)] tracking-tight">
          {card.value}
        </p>
        <p className="text-xs text-[var(--muted)] mt-2 font-medium">{card.label}</p>
        {card.sub && (
          <p className="text-[11px] text-[var(--muted)] mt-1 opacity-80">{card.sub}</p>
        )}
      </div>
    </div>
  )
}

function StatsSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-[140px] glass rounded-[var(--radius)] animate-pulse" />
      ))}
    </div>
  )
}

export function OverviewStats() {
  const featureFlags = useAuthStore((s) => s.featureFlags)
  const showPayments = featureFlags.payments
  const showPatients = featureFlags.patients

  const { data: bookingStats, isLoading: bookingsLoading } = useBookingStats()
  const { data: patientStats, isLoading: patientsLoading } = usePatientStats()

  const loading = bookingsLoading || (showPatients && patientsLoading)
  const visibleCount = 2 + (showPayments ? 1 : 0) + (showPatients ? 1 : 0)

  if (loading) return <StatsSkeleton count={visibleCount} />

  const cards: StatCard[] = []

  cards.push({
    label: 'حجوزات اليوم',
    value: bookingStats?.today ?? 0,
    icon: 'hgi-calendar-03',
    variant: 'primary',
    sub: `${bookingStats?.confirmed ?? 0} مؤكدة · ${bookingStats?.pending ?? 0} معلقة`,
  })

  if (showPayments) {
    cards.push({
      label: 'إيراد الشهر (ر.س)',
      value: '—',
      icon: 'hgi-money-bag-02',
      variant: 'success',
      sub: 'متوفر في المرحلة القادمة',
    })
  }

  if (showPatients) {
    cards.push({
      label: 'إجمالي المرضى',
      value: patientStats?.total ?? 0,
      icon: 'hgi-user-multiple-02',
      variant: 'warning',
      sub: `${patientStats?.newThisWeek ?? 0} مريض جديد هذا الأسبوع`,
    })
  }

  cards.push({
    label: 'حجوزات معلقة',
    value: bookingStats?.pending ?? 0,
    icon: 'hgi-hourglass',
    variant: 'accent',
    sub: 'تحتاج متابعة',
  })

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <StatCardView key={i} card={card} />
      ))}
    </div>
  )
}
