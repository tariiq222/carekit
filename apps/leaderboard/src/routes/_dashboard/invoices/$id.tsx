import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { PageHeader } from '@/components/shared/page-header'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { HIcon } from '@/components/shared/hicon'
import { useInvoice, useInvoiceHtmlPath } from '@/hooks/use-invoices'
import { InvoiceStatusBadge } from '@/components/features/invoices/invoice-status-badge'

export const Route = createFileRoute('/_dashboard/invoices/$id')({
  component: InvoiceDetailPage,
})

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

function formatHalalat(halalat: number | null | undefined): string {
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

function InvoiceDetailPage() {
  const { id } = Route.useParams()
  const { data: invoice, isLoading } = useInvoice(id)
  const htmlPath = useInvoiceHtmlPath(id)
  const [showPreview, setShowPreview] = useState(false)

  if (isLoading) return <SkeletonPage />
  if (!invoice) {
    return <p className="text-[var(--muted)] p-6">الفاتورة غير موجودة</p>
  }

  const baseUrl = (
    (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ?? ''
  )
  const fullHtmlUrl = `${baseUrl}${htmlPath}`

  return (
    <div className="space-y-6">
      <PageHeader
        title={`فاتورة ${invoice.invoiceNumber}`}
        description={formatDate(invoice.createdAt)}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPreview((v) => !v)}
            >
              <HIcon name="hgi-eye" className="me-1" />
              {showPreview ? 'إخفاء المعاينة' : 'معاينة HTML'}
            </Button>
            <Link to="/invoices">
              <Button variant="outline">رجوع</Button>
            </Link>
          </div>
        }
      />

      <div className="glass rounded-[var(--radius)] p-6 max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <InvoiceStatusBadge invoice={invoice} />
          <span className="text-2xl font-bold text-[var(--fg)]">
            {formatHalalat(invoice.payment?.totalAmount)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="رقم الفاتورة" value={invoice.invoiceNumber} />
          <Field label="تاريخ الإنشاء" value={formatDate(invoice.createdAt)} />
          <Field label="تاريخ الإرسال" value={formatDate(invoice.sentAt)} />
          <Field label="ضريبة القيمة المضافة" value={formatHalalat(invoice.vatAmount)} />
          <Field label="نسبة الضريبة" value={`${invoice.vatRate}%`} />
          <Field label="حالة ZATCA" value={invoice.zatcaStatus} />
        </div>

        {invoice.payment && (
          <div className="rounded-[var(--radius-sm)] border border-[var(--border-soft)] p-4 space-y-3">
            <h3 className="text-sm font-semibold text-[var(--fg)]">المدفوعة</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="المبلغ" value={formatHalalat(invoice.payment.amount)} />
              <Field label="الإجمالي" value={formatHalalat(invoice.payment.totalAmount)} />
              <Field label="الطريقة" value={invoice.payment.method} />
              <Field
                label="المريض"
                value={
                  invoice.payment.booking?.patient
                    ? `${invoice.payment.booking.patient.firstName} ${invoice.payment.booking.patient.lastName}`
                    : '—'
                }
              />
            </div>
            <Link
              to="/payments/$id"
              params={{ id: invoice.payment.id }}
              className="text-sm text-[var(--primary)] hover:underline inline-flex items-center gap-1"
            >
              عرض المدفوعة <HIcon name="hgi-arrow-left-01" />
            </Link>
          </div>
        )}
      </div>

      {showPreview && (
        <div className="glass rounded-[var(--radius)] p-2 max-w-5xl">
          <iframe
            src={fullHtmlUrl}
            title={`Invoice ${invoice.invoiceNumber}`}
            className="w-full h-[800px] rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-white"
          />
        </div>
      )}
    </div>
  )
}
