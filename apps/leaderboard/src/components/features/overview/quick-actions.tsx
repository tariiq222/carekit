import { Link } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/stores/auth.store'
import type { FeatureFlags } from '@carekit/api-client'
import { HIcon } from '@/components/shared/hicon'

type RouteTo = '/bookings/new' | '/patients/new'

interface Action {
  label: string
  sub: string
  icon: string
  variant: 'primary' | 'success' | 'warning' | 'accent'
  flag?: keyof FeatureFlags
  /** Defined = enabled link. Undefined = disabled placeholder. */
  to?: RouteTo
}

const variantStyles: Record<Action['variant'], string> = {
  primary: 'bg-[var(--primary-ultra)] text-[var(--primary)]',
  success: 'bg-[var(--success-bg)] text-[var(--success)]',
  warning: 'bg-[var(--warning-bg)] text-[var(--warning)]',
  accent:  'bg-[var(--accent-ultra)] text-[var(--accent-dark)]',
}

const ACTIONS: Action[] = [
  { label: 'حجز جديد',     sub: 'إضافة موعد للمريض',        icon: 'hgi-calendar-add-02', to: '/bookings/new', variant: 'primary', flag: 'bookings' },
  { label: 'مريض جديد',    sub: 'تسجيل مريض في النظام',     icon: 'hgi-user-add-01',     to: '/patients/new', variant: 'success', flag: 'patients' },
  { label: 'تسجيل دفعة',   sub: 'تسجيل مبلغ مستلم',         icon: 'hgi-credit-card',                          variant: 'warning', flag: 'payments' },
  { label: 'فاتورة جديدة', sub: 'إنشاء فاتورة للمريض',      icon: 'hgi-invoice-01',                           variant: 'accent',  flag: 'invoices' },
]

function ActionCard({ action }: { action: Action }) {
  const inner = (
    <div className="flex items-center gap-3 w-full">
      <div
        className={[
          'w-10 h-10 rounded-[var(--radius-sm)] flex items-center justify-center flex-shrink-0',
          variantStyles[action.variant],
        ].join(' ')}
      >
        <HIcon name={action.icon} size={18} />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[13px] font-semibold text-[var(--fg)] leading-tight">{action.label}</span>
        <span className="text-[11px] text-[var(--muted)] leading-tight truncate">{action.sub}</span>
      </div>
    </div>
  )

  const classes =
    'flex items-center p-3.5 rounded-[var(--radius-sm)] border border-[rgba(0,0,0,0.08)] bg-[rgba(255,255,255,0.55)] transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-[rgba(255,255,255,0.88)] duration-150 cursor-pointer'

  if (action.to) {
    return (
      <Link
        to={action.to}
        className={`${classes} hover:border-[color:var(--primary)]/25`}
      >
        {inner}
      </Link>
    )
  }

  return (
    <button
      type="button"
      disabled
      title="متاح في المرحلة القادمة"
      className={`${classes} opacity-50 cursor-not-allowed`}
    >
      {inner}
    </button>
  )
}

export function QuickActions() {
  const featureFlags = useAuthStore((s) => s.featureFlags)
  const visible = ACTIONS.filter((a) => !a.flag || featureFlags[a.flag])

  if (visible.length === 0) return null

  return (
    <section className="glass rounded-[var(--radius)] p-5 flex flex-col gap-4">
      <h2 className="text-base font-bold text-[var(--fg)]">إجراءات سريعة</h2>
      <div className="flex flex-col gap-2">
        {visible.map((action) => (
          <ActionCard key={action.label} action={action} />
        ))}
      </div>
    </section>
  )
}
