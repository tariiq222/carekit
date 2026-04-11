import type { PaymentStatus } from '@carekit/api-client'

type Variant = 'primary' | 'success' | 'warning' | 'error' | 'muted'

const STATUS_MAP: Record<PaymentStatus, { label: string; variant: Variant }> = {
  pending: { label: 'معلق', variant: 'warning' },
  awaiting: { label: 'بانتظار', variant: 'warning' },
  paid: { label: 'مدفوع', variant: 'success' },
  refunded: { label: 'مسترد', variant: 'muted' },
  failed: { label: 'فشل', variant: 'error' },
  rejected: { label: 'مرفوض', variant: 'error' },
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
  muted: 'bg-[var(--surface)] text-[var(--muted)] border-[var(--border-soft)]',
}

interface Props {
  status: PaymentStatus
}

export function PaymentStatusBadge({ status }: Props) {
  const { label, variant } = STATUS_MAP[status]
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-sm)] border px-2 py-0.5 text-xs font-medium ${VARIANT_CLASSES[variant]}`}
    >
      {label}
    </span>
  )
}
