import { Link } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/stores/auth.store'
import type { FeatureFlags } from '@carekit/api-client'

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
    <>
      <div
        className={[
          'w-11 h-11 rounded-[var(--radius-sm)] flex items-center justify-center border border-[var(--border-soft)]',
          variantStyles[action.variant],
        ].join(' ')}
      >
        <i className={`hgi ${action.icon} text-lg`} />
      </div>
      <span className="text-[13px] font-semibold text-[var(--fg-2)]">{action.label}</span>
      <span className="text-[11px] text-[var(--muted)] mt-0.5 text-center leading-tight">{action.sub}</span>
    </>
  )

  const classes =
    'flex flex-col items-center justify-center gap-2 p-5 rounded-[var(--radius-sm)] border border-[var(--border-soft)] transition-all hover:-translate-y-0.5 transition-transform duration-150'

  if (action.to) {
    return (
      <Link
        to={action.to}
        className={`${classes} hover:border-[color:var(--primary)]/30 hover:bg-[var(--surface)]`}
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
      <div className="grid grid-cols-2 gap-3">
        {visible.map((action) => (
          <ActionCard key={action.label} action={action} />
        ))}
      </div>
    </section>
  )
}
