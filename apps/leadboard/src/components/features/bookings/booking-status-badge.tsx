import type { BookingStatus } from '@carekit/api-client'

type Variant = 'primary' | 'success' | 'warning' | 'error' | 'muted'

const STATUS_MAP: Record<BookingStatus, { label: string; variant: Variant }> = {
  pending: { label: 'معلق', variant: 'warning' },
  confirmed: { label: 'مؤكد', variant: 'success' },
  checked_in: { label: 'وصل', variant: 'primary' },
  in_progress: { label: 'جارٍ', variant: 'primary' },
  completed: { label: 'مكتمل', variant: 'success' },
  cancelled: { label: 'ملغى', variant: 'error' },
  pending_cancellation: { label: 'طلب إلغاء', variant: 'warning' },
  no_show: { label: 'لم يحضر', variant: 'muted' },
  expired: { label: 'منتهي', variant: 'muted' },
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-[var(--primary-bg)] text-[var(--primary)] border-[color:var(--primary)]/30',
  success:
    'bg-[var(--success-bg)] text-[var(--success)] border-[color:var(--success)]/30',
  warning:
    'bg-[var(--warning-bg)] text-[var(--warning)] border-[color:var(--warning)]/30',
  error:
    'bg-[var(--error-bg,#fee)] text-[var(--error,#dc2626)] border-[color:var(--error,#dc2626)]/30',
  muted:
    'bg-[var(--surface)] text-[var(--muted)] border-[var(--border-soft)]',
}

interface Props {
  status: BookingStatus
}

export function BookingStatusBadge({ status }: Props) {
  const { label, variant } = STATUS_MAP[status]
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-sm)] border px-2 py-0.5 text-xs font-medium ${VARIANT_CLASSES[variant]}`}
    >
      {label}
    </span>
  )
}
