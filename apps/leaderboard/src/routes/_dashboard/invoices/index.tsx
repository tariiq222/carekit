import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { HIcon } from '@/components/shared/hicon'
import type {
  InvoiceListItem,
  InvoiceListQuery,
} from '@carekit/api-client'
import { PageHeader } from '@/components/shared/page-header'
import { StatsGrid } from '@/components/shared/stats-grid'
import { FilterBar } from '@/components/shared/filter-bar'
import { DataTable } from '@/components/shared/data-table'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useInvoices, useInvoiceStats } from '@/hooks/use-invoices'
import { InvoiceStatusBadge } from '@/components/features/invoices/invoice-status-badge'

export const Route = createFileRoute('/_dashboard/invoices/')({
  component: InvoicesListPage,
})

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

function InvoicesListPage() {
  const [query, setQuery] = useState<InvoiceListQuery>({ page: 1, perPage: 20 })
  const [search, setSearch] = useState('')

  const { data: stats, isLoading: statsLoading } = useInvoiceStats()
  const { data, isLoading } = useInvoices({ ...query, search: search || undefined })

  if (isLoading && !data) return <SkeletonPage />

  const statCards = [
    {
      label: 'إجمالي الفواتير',
      value: stats?.total ?? 0,
      icon: 'hgi-invoice-03',
      variant: 'primary' as const,
    },
    {
      label: 'مرسلة',
      value: stats?.sent ?? 0,
      icon: 'hgi-tick-double-01',
      variant: 'success' as const,
    },
    {
      label: 'معلقة',
      value: stats?.pending ?? 0,
      icon: 'hgi-hourglass',
      variant: 'warning' as const,
    },
    {
      label: 'ZATCA المرسلة',
      value: stats?.zatca?.reported ?? 0,
      icon: 'hgi-shield-01',
      variant: 'accent' as const,
    },
  ]

  const columns = [
    {
      key: 'invoiceNumber',
      header: 'رقم الفاتورة',
      render: (i: InvoiceListItem) => i.invoiceNumber,
    },
    {
      key: 'patient',
      header: 'المريض',
      render: (i: InvoiceListItem) =>
        i.payment?.booking?.patient
          ? `${i.payment.booking.patient.firstName} ${i.payment.booking.patient.lastName}`
          : '—',
    },
    {
      key: 'amount',
      header: 'المبلغ',
      render: (i: InvoiceListItem) =>
        i.payment ? formatHalalat(i.payment.totalAmount) : '—',
    },
    {
      key: 'vat',
      header: 'الضريبة',
      render: (i: InvoiceListItem) => formatHalalat(i.vatAmount),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (i: InvoiceListItem) => <InvoiceStatusBadge invoice={i} />,
    },
    {
      key: 'date',
      header: 'التاريخ',
      render: (i: InvoiceListItem) => formatDate(i.createdAt),
    },
    {
      key: 'actions',
      header: '',
      render: (i: InvoiceListItem) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/invoices/$id"
              params={{ id: i.id }}
              className="inline-flex items-center justify-center size-7 rounded-sm text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)] transition-colors"
            >
              <HIcon name="hgi-eye" />
            </Link>
          </TooltipTrigger>
          <TooltipContent>عرض الفاتورة</TooltipContent>
        </Tooltip>
      ),
    },
  ]

  const meta = data?.meta

  return (
    <div className="space-y-6">
      <PageHeader title="الفواتير" description="فواتير العيادة (تنشأ تلقائيًا من الحجوزات)" />

      <StatsGrid stats={statCards} loading={statsLoading} />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        onReset={() => {
          setSearch('')
          setQuery({ page: 1, perPage: 20 })
        }}
        placeholder="بحث برقم الفاتورة أو اسم المريض..."
      >
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

      <DataTable<InvoiceListItem>
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(i) => i.id}
        loading={isLoading}
        emptyMessage="لا توجد فواتير"
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
