import { createFileRoute, Link } from '@tanstack/react-router'
import { PageHeader } from '@/components/shared/page-header'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { usePayment } from '@/hooks/use-payments'
import { PaymentStatusBadge } from '@/components/features/payments/payment-status-badge'
import type {
  PaymentListItem,
  PaymentMethod,
} from '@carekit/api-client'

export const Route = createFileRoute('/_dashboard/payments/$id')({
  component: PaymentDetailPage,
})

const METHOD_LABELS: Record<PaymentMethod, string> = {
  moyasar: 'ميسر',
  bank_transfer: 'تحويل بنكي',
  cash: 'نقدًا',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatHalalat(halalat: number | null): string {
  if (halalat == null) return '—'
  const sar = halalat / 100
  return `${sar.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted)] mb-1">{label}</p>
      <p className="text-sm text-[var(--fg)]">{value}</p>
    </div>
  )
}

function PaymentDetailPage() {
  const { id } = Route.useParams()
  const { data: payment, isLoading } = usePayment(id)

  if (isLoading) return <SkeletonPage />
  if (!payment) {
    return <p className="text-[var(--muted)] p-6">المدفوعة غير موجودة</p>
  }

  const p: PaymentListItem = payment

  return (
    <div className="space-y-6">
      <PageHeader
        title="تفاصيل المدفوعة"
        description={p.transactionRef || p.moyasarPaymentId || p.id}
        actions={
          <Link to="/payments">
            <Button variant="outline">رجوع</Button>
          </Link>
        }
      />

      <div className="glass rounded-[var(--radius)] p-6 max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <PaymentStatusBadge status={p.status} />
          <span className="text-2xl font-bold text-[var(--fg)]">
            {formatHalalat(p.totalAmount || p.amount)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="المبلغ الأساسي" value={formatHalalat(p.amount)} />
          <Field label="ضريبة القيمة المضافة" value={formatHalalat(p.vatAmount)} />
          <Field label="الإجمالي" value={formatHalalat(p.totalAmount)} />
          <Field label="طريقة الدفع" value={METHOD_LABELS[p.method]} />
          <Field label="مرجع المعاملة" value={p.transactionRef ?? '—'} />
          <Field
            label="معرف ميسر"
            value={p.moyasarPaymentId ?? '—'}
          />
          <Field label="تاريخ الإنشاء" value={formatDate(p.createdAt)} />
          <Field label="آخر تحديث" value={formatDate(p.updatedAt)} />
        </div>

        {p.refundAmount != null && (
          <div className="rounded-[var(--radius-sm)] border border-[var(--border-soft)] p-4 space-y-3">
            <h3 className="text-sm font-semibold text-[var(--fg)]">
              معلومات الاسترداد
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="المبلغ المسترد" value={formatHalalat(p.refundAmount)} />
              <Field label="تاريخ الاسترداد" value={formatDate(p.refundedAt)} />
              <Field label="بواسطة" value={p.refundedBy ?? '—'} />
              <Field label="السبب" value={p.refundReason ?? '—'} />
            </div>
          </div>
        )}

        {p.booking && (
          <div className="rounded-[var(--radius-sm)] border border-[var(--border-soft)] p-4 space-y-3">
            <h3 className="text-sm font-semibold text-[var(--fg)]">الحجز المرتبط</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="المريض"
                value={
                  p.booking.patient
                    ? `${p.booking.patient.firstName} ${p.booking.patient.lastName}`
                    : '—'
                }
              />
              <Field label="الخدمة" value={p.booking.service?.nameAr ?? '—'} />
              <Field label="التاريخ" value={formatDate(p.booking.date)} />
              <Field label="الوقت" value={p.booking.startTime} />
            </div>
          </div>
        )}

        {p.invoice && (
          <div className="rounded-[var(--radius-sm)] border border-[var(--border-soft)] p-4">
            <h3 className="text-sm font-semibold text-[var(--fg)] mb-2">
              الفاتورة المرتبطة
            </h3>
            <Link
              to="/invoices/$id"
              params={{ id: p.invoice.id }}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              {p.invoice.invoiceNumber}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
