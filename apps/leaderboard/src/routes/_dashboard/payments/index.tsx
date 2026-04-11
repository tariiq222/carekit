import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import type {
  PaymentListItem,
  PaymentListQuery,
  PaymentMethod,
  PaymentStatus,
} from '@carekit/api-client'
import { PageHeader } from '@/components/shared/page-header'
import { StatsGrid } from '@/components/shared/stats-grid'
import { FilterBar } from '@/components/shared/filter-bar'
import { DataTable } from '@/components/shared/data-table'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { usePayments, usePaymentStats } from '@/hooks/use-payments'
import { PaymentStatusBadge } from '@/components/features/payments/payment-status-badge'

export const Route = createFileRoute('/_dashboard/payments/')({
  component: PaymentsListPage,
})

const STATUS_OPTIONS: Array<{ value: '' | PaymentStatus; label: string }> = [
  { value: '', label: 'كل الحالات' },
  { value: 'pending', label: 'معلق' },
  { value: 'awaiting', label: 'بانتظار' },
  { value: 'paid', label: 'مدفوع' },
  { value: 'refunded', label: 'مسترد' },
  { value: 'failed', label: 'فشل' },
  { value: 'rejected', label: 'مرفوض' },
]

const METHOD_LABELS: Record<PaymentMethod, string> = {
  moyasar: 'ميسر',
  bank_transfer: 'تحويل بنكي',
  cash: 'نقدًا',
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

function formatHalalat(halalat: number): string {
  const sar = halalat / 100
  return `${sar.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`
}

function PaymentsListPage() {
  const [query, setQuery] = useState<PaymentListQuery>({ page: 1, perPage: 20 })
  const [search, setSearch] = useState('')

  const { data: stats, isLoading: statsLoading } = usePaymentStats()
  const { data, isLoading } = usePayments(query)

  if (isLoading && !data) return <SkeletonPage />

  const statCards = [
    {
      label: 'إجمالي المدفوعات',
      value: stats?.total ?? 0,
      icon: 'hgi-credit-card',
      variant: 'primary' as const,
    },
    {
      label: 'مدفوعة',
      value: stats?.paid ?? 0,
      icon: 'hgi-tick-double-01',
      variant: 'success' as const,
    },
    {
      label: 'فاشلة',
      value: stats?.failed ?? 0,
      icon: 'hgi-alert-02',
      variant: 'warning' as const,
    },
    {
      label: 'مستردة',
      value: stats?.refunded ?? 0,
      icon: 'hgi-refresh',
      variant: 'accent' as const,
    },
  ]

  const filtered = (data?.items ?? []).filter((p) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return (
      p.transactionRef?.toLowerCase().includes(q) ||
      p.moyasarPaymentId?.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    )
  })

  const columns = [
    {
      key: 'reference',
      header: 'المرجع',
      render: (p: PaymentListItem) =>
        p.transactionRef || p.moyasarPaymentId || p.id.slice(0, 8),
    },
    {
      key: 'amount',
      header: 'المبلغ',
      render: (p: PaymentListItem) => formatHalalat(p.totalAmount || p.amount),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (p: PaymentListItem) => <PaymentStatusBadge status={p.status} />,
    },
    {
      key: 'method',
      header: 'الطريقة',
      render: (p: PaymentListItem) => METHOD_LABELS[p.method],
    },
    {
      key: 'patient',
      header: 'المريض',
      render: (p: PaymentListItem) =>
        p.booking?.patient
          ? `${p.booking.patient.firstName} ${p.booking.patient.lastName}`
          : '—',
    },
    {
      key: 'date',
      header: 'التاريخ',
      render: (p: PaymentListItem) => formatDate(p.createdAt),
    },
    {
      key: 'actions',
      header: '',
      render: (p: PaymentListItem) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/payments/$id"
              params={{ id: p.id }}
              className="inline-flex items-center justify-center size-9 rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)] transition-colors"
            >
              <i className="hgi hgi-eye" />
            </Link>
          </TooltipTrigger>
          <TooltipContent>عرض التفاصيل</TooltipContent>
        </Tooltip>
      ),
    },
  ]

  const meta = data?.meta

  return (
    <div className="space-y-6">
      <PageHeader title="المدفوعات" description="سجل المدفوعات (للعرض فقط)" />

      <StatsGrid stats={statCards} loading={statsLoading} />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        onReset={() => {
          setSearch('')
          setQuery({ page: 1, perPage: 20 })
        }}
        placeholder="بحث بالمرجع..."
      >
        <select
          value={query.status ?? ''}
          onChange={(e) =>
            setQuery((q) => ({
              ...q,
              page: 1,
              status: (e.target.value || undefined) as PaymentStatus | undefined,
            }))
          }
          className="h-9 rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-solid)] text-sm text-[var(--fg)] px-3"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={query.dateFrom ?? ''}
          onChange={(e) =>
            setQuery((q) => ({ ...q, page: 1, dateFrom: e.target.value || undefined }))
          }
          className="h-9 rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-solid)] text-sm text-[var(--fg)] px-3"
        />
        <input
          type="date"
          value={query.dateTo ?? ''}
          onChange={(e) =>
            setQuery((q) => ({ ...q, page: 1, dateTo: e.target.value || undefined }))
          }
          className="h-9 rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-solid)] text-sm text-[var(--fg)] px-3"
        />
      </FilterBar>

      <DataTable<PaymentListItem>
        columns={columns}
        data={filtered}
        keyExtractor={(p) => p.id}
        loading={isLoading}
        emptyMessage="لا توجد مدفوعات"
      />

      {meta && meta.totalPages > 1 && (
        <div className="glass rounded-[var(--radius)] p-3 flex items-center justify-between">
          <span className="text-xs text-[var(--muted)]">
            صفحة {meta.page} من {meta.totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={!meta.hasPreviousPage}
              onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) - 1 }))}
              className="h-9 px-3 rounded-[var(--radius-sm)] border border-[var(--border-soft)] text-xs disabled:opacity-50"
            >
              السابق
            </button>
            <button
              disabled={!meta.hasNextPage}
              onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))}
              className="h-9 px-3 rounded-[var(--radius-sm)] border border-[var(--border-soft)] text-xs disabled:opacity-50"
            >
              التالي
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
