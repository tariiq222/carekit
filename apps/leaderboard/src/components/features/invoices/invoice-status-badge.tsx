import type { InvoiceListItem } from '@carekit/api-client'

type Variant = 'primary' | 'success' | 'warning' | 'muted'

interface Props {
  invoice: Pick<InvoiceListItem, 'sentAt'>
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-[var(--primary-bg)] text-[var(--primary)] border-[color:var(--primary)]/30',
  success:
    'bg-[var(--success-bg)] text-[var(--success)] border-[color:var(--success)]/30',
  warning:
    'bg-[var(--warning-bg)] text-[var(--warning)] border-[color:var(--warning)]/30',
  muted: 'bg-[var(--surface)] text-[var(--muted)] border-[var(--border-soft)]',
}

export function InvoiceStatusBadge({ invoice }: Props) {
  const sent = !!invoice.sentAt
  const variant: Variant = sent ? 'success' : 'warning'
  const label = sent ? 'مرسلة' : 'معلقة'
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-sm)] border px-2 py-0.5 text-xs font-medium ${VARIANT_CLASSES[variant]}`}
    >
      {label}
    </span>
  )
}
