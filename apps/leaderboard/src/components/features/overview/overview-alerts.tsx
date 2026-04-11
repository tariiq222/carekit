import { Link } from '@tanstack/react-router'
import { useBookingStats } from '@/hooks/use-bookings'

interface Alert {
  title: string
  desc: string
  icon: string
  tone: 'error' | 'warning' | 'info'
  to: '/bookings'
  search?: { status: 'pending' }
}

const toneStyles: Record<Alert['tone'], { bg: string; text: string; border: string }> = {
  error:   { bg: 'bg-[var(--error-bg,#fee)]',   text: 'text-[var(--error,#dc2626)]', border: 'border-[color:var(--error,#dc2626)]/20' },
  warning: { bg: 'bg-[var(--warning-bg)]',      text: 'text-[var(--warning)]',       border: 'border-[color:var(--warning)]/20' },
  info:    { bg: 'bg-[var(--primary-ultra)]',   text: 'text-[var(--primary)]',       border: 'border-[color:var(--primary)]/20' },
}

export function OverviewAlerts() {
  const { data: stats, isLoading } = useBookingStats()

  if (isLoading) {
    return (
      <section className="glass rounded-[var(--radius)] p-5 flex flex-col gap-4">
        <h2 className="text-base font-bold text-[var(--fg)]">تنبيهات</h2>
        <div className="h-16 rounded-[var(--radius-sm)] bg-[var(--surface)] animate-pulse" />
      </section>
    )
  }

  const alerts: Alert[] = []

  if ((stats?.pending ?? 0) > 0) {
    alerts.push({
      title: `${stats!.pending} حجز معلق`,
      desc: 'يحتاج تأكيد أو مراجعة',
      icon: 'hgi-alert-02',
      tone: 'warning',
      to: '/bookings',
      search: { status: 'pending' },
    })
  }

  return (
    <section className="glass rounded-[var(--radius)] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-[var(--fg)]">تنبيهات</h2>
        {alerts.length > 0 && (
          <span className="text-[11px] font-medium text-[var(--muted)]">{alerts.length}</span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-6 text-xs text-[var(--muted)]">
          <i className="hgi hgi-tick-02 text-2xl mb-1 block opacity-60" />
          لا توجد تنبيهات
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {alerts.map((alert, i) => {
            const tone = toneStyles[alert.tone]
            return (
              <Link
                key={i}
                to={alert.to}
                className={`flex items-start gap-3 p-3 rounded-[var(--radius-sm)] border ${tone.border} ${tone.bg} hover:opacity-90 transition-opacity`}
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${tone.text}`}
                >
                  <i className={`hgi ${alert.icon} text-base`} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold ${tone.text}`}>{alert.title}</p>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5">{alert.desc}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
