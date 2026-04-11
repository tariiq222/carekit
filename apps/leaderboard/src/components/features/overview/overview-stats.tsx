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

const variantStyles: Record<StatCard['variant'], { icon: string; value: string }> = {
  primary: { icon: 'bg-[var(--primary-ultra)] text-[var(--primary)]', value: 'text-[var(--primary)]' },
  success: { icon: 'bg-[var(--success-bg)] text-[var(--success)]',   value: 'text-[var(--success)]' },
  warning: { icon: 'bg-[var(--warning-bg)] text-[var(--warning)]',   value: 'text-[var(--warning)]' },
  accent:  { icon: 'bg-[var(--accent-ultra)] text-[var(--accent-dark)]', value: 'text-[var(--accent-dark)]' },
}

function StatCardView({ card }: { card: StatCard }) {
  return (
    <div className="glass rounded-[var(--radius)] p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div
          className={[
            'w-11 h-11 rounded-[var(--radius-sm)] flex items-center justify-center',
            variantStyles[card.variant].icon,
          ].join(' ')}
        >
          <i className={`hgi ${card.icon} text-lg`} />
        </div>
      </div>
      <div>
        <p className={`text-[32px] font-extrabold leading-none tracking-tight ${variantStyles[card.variant].value}`}>
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

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
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

  if (loading) return <StatsSkeleton />

  const cards: StatCard[] = [
    {
      label: 'حجوزات اليوم',
      value: bookingStats?.today ?? 0,
      icon: 'hgi-calendar-03',
      variant: 'primary',
      sub: `${bookingStats?.confirmed ?? 0} مؤكدة · ${bookingStats?.pending ?? 0} معلقة`,
    },
    {
      label: 'حجوزات معلقة',
      value: bookingStats?.pending ?? 0,
      icon: 'hgi-hourglass',
      variant: 'warning',
      sub: 'تحتاج متابعة',
    },
    showPatients
      ? {
          label: 'إجمالي المرضى',
          value: patientStats?.total ?? 0,
          icon: 'hgi-user-multiple-02',
          variant: 'success' as const,
          sub: `${patientStats?.newThisWeek ?? 0} مريض جديد هذا الأسبوع`,
        }
      : {
          label: 'المرضى',
          value: '—',
          icon: 'hgi-user-multiple-02',
          variant: 'success' as const,
          sub: 'يُفعّل قريباً',
        },
    {
      label: 'إيراد الشهر (ر.س)',
      value: '—',
      icon: 'hgi-money-bag-02',
      variant: 'accent',
      sub: showPayments ? undefined : 'متوفر في المرحلة القادمة',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <StatCardView key={i} card={card} />
      ))}
    </div>
  )
}
