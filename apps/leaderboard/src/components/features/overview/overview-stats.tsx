import { useBookingStats } from '@/hooks/use-bookings'
import { HIcon } from '@/components/shared/hicon'
import { usePatientStats } from '@/hooks/use-patients'
import { useAuthStore } from '@/lib/stores/auth.store'

interface StatCard {
  label: string
  value: string | number
  icon: string
  variant: 'primary' | 'success' | 'warning' | 'accent'
  sub?: string
}

const variantStyles: Record<
  StatCard['variant'],
  { icon: string; value: string; glow: string; shimmer: string }
> = {
  primary: {
    icon: 'bg-[var(--primary-ultra)] text-[var(--primary)]',
    value: 'text-[var(--primary)]',
    glow: 'rgba(53,79,216,0.06)',
    shimmer: 'rgba(53,79,216,0.04)',
  },
  success: {
    icon: 'bg-[var(--success-bg)] text-[var(--success)]',
    value: 'text-[var(--success)]',
    glow: 'rgba(22,163,74,0.06)',
    shimmer: 'rgba(22,163,74,0.03)',
  },
  warning: {
    icon: 'bg-[var(--warning-bg)] text-[var(--warning)]',
    value: 'text-[var(--warning)]',
    glow: 'rgba(217,119,6,0.06)',
    shimmer: 'rgba(217,119,6,0.03)',
  },
  accent: {
    icon: 'bg-[var(--accent-ultra)] text-[var(--accent-dark)]',
    value: 'text-[var(--accent-dark)]',
    glow: 'rgba(130,204,23,0.07)',
    shimmer: 'rgba(130,204,23,0.03)',
  },
}

function StatCardView({ card }: { card: StatCard }) {
  const styles = variantStyles[card.variant]

  return (
    <div
      className="stat-card-ck"
      style={{
        background: `linear-gradient(135deg, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.72) 100%), radial-gradient(circle at 0% 0%, ${styles.glow} 0%, transparent 60%)`,
      }}
    >
      {/* Shimmer top line */}
      <div className="stat-card-shimmer" />

      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div
          className={[
            'w-11 h-11 rounded-[var(--radius-sm)] flex items-center justify-center flex-shrink-0',
            styles.icon,
          ].join(' ')}
        >
          <HIcon name={card.icon} size={20} />
        </div>
      </div>

      {/* Value */}
      <p className={`text-[32px] font-extrabold leading-none tracking-tight mb-2 ${styles.value}`}>
        {card.value}
      </p>

      {/* Label + sub */}
      <p className="text-[13px] font-semibold text-[var(--fg-2)] leading-tight">{card.label}</p>
      {card.sub && (
        <p className="text-[11.5px] text-[var(--muted)] mt-1.5 leading-relaxed">{card.sub}</p>
      )}
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-[148px] glass rounded-[var(--radius)] animate-pulse" />
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
