import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import type {
  GiftCardListItem,
  GiftCardListQuery,
  GiftCardStatusFilter,
} from '@carekit/api-client'
import { PageHeader } from '@/components/shared/page-header'
import { StatsGrid } from '@/components/shared/stats-grid'
import { FilterBar } from '@/components/shared/filter-bar'
import { DataTable } from '@/components/shared/data-table'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useDeactivateGiftCard, useGiftCards } from '@/hooks/use-gift-cards'

export const Route = createFileRoute('/_dashboard/gift-cards/')({
  component: GiftCardsListPage,
})

const STATUS_OPTIONS: Array<{ value: '' | GiftCardStatusFilter; label: string }> = [
  { value: '', label: 'كل الحالات' },
  { value: 'active', label: 'فعال' },
  { value: 'inactive', label: 'غير فعال' },
  { value: 'expired', label: 'منتهي' },
  { value: 'depleted', label: 'مستنفد' },
]

function formatDate(iso: string | null) {
  if (!iso) return '—'
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

function statusBadge(g: GiftCardListItem) {
  const expired = g.expiresAt && new Date(g.expiresAt) < new Date()
  const depleted = g.balance <= 0
  if (expired) {
    return (
      <span className="inline-flex items-center rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--muted)]">
        منتهي
      </span>
    )
  }
  if (depleted) {
    return (
      <span className="inline-flex items-center rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--muted)]">
        مستنفد
      </span>
    )
  }
  if (!g.isActive) {
    return (
      <span className="inline-flex items-center rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--muted)]">
        غير فعال
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-[var(--radius-sm)] border border-[color:var(--success)]/30 bg-[var(--success-bg)] px-2 py-0.5 text-xs text-[var(--success)]">
      فعال
    </span>
  )
}

function GiftCardsListPage() {
  const [query, setQuery] = useState<GiftCardListQuery>({ page: 1, perPage: 20 })
  const [search, setSearch] = useState('')

  const { data, isLoading } = useGiftCards({ ...query, search: search || undefined })
  const deactivateMutation = useDeactivateGiftCard()

  if (isLoading && !data) return <SkeletonPage />

  const items = data?.items ?? []
  const now = new Date()
  const active = items.filter(
    (g) =>
      g.isActive && g.balance > 0 && (!g.expiresAt || new Date(g.expiresAt) >= now),
  ).length
  const expired = items.filter(
    (g) => g.expiresAt && new Date(g.expiresAt) < now,
  ).length
  const depleted = items.filter((g) => g.balance <= 0).length

  const statCards = [
    {
      label: 'إجمالي البطاقات',
      value: data?.meta.total ?? items.length,
      icon: 'hgi-gift',
      variant: 'primary' as const,
    },
    {
      label: 'فعالة',
      value: active,
      icon: 'hgi-tick-double-01',
      variant: 'success' as const,
    },
    {
      label: 'مستنفدة',
      value: depleted,
      icon: 'hgi-coins-01',
      variant: 'warning' as const,
    },
    {
      label: 'منتهية',
      value: expired,
      icon: 'hgi-hourglass',
      variant: 'accent' as const,
    },
  ]

  const handleDeactivate = (id: string) => {
    if (!confirm('هل أنت متأكد من إلغاء تفعيل هذه البطاقة؟')) return
    deactivateMutation.mutate(id)
  }

  const columns = [
    {
      key: 'code',
      header: 'الكود',
      render: (g: GiftCardListItem) => (
        <span className="font-mono text-[var(--fg)]">{g.code}</span>
      ),
    },
    {
      key: 'initialAmount',
      header: 'القيمة الأصلية',
      render: (g: GiftCardListItem) => formatHalalat(g.initialAmount),
    },
    {
      key: 'balance',
      header: 'الرصيد',
      render: (g: GiftCardListItem) => formatHalalat(g.balance),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (g: GiftCardListItem) => statusBadge(g),
    },
    {
      key: 'expiresAt',
      header: 'ينتهي في',
      render: (g: GiftCardListItem) => formatDate(g.expiresAt),
    },
    {
      key: 'actions',
      header: '',
      render: (g: GiftCardListItem) => (
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/gift-cards/$id"
                params={{ id: g.id }}
                className="inline-flex items-center justify-center size-9 rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)] transition-colors"
              >
                <i className="hgi hgi-edit-02" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>تعديل</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleDeactivate(g.id)}
                className="inline-flex items-center justify-center size-9 rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--error,#dc2626)] transition-colors"
              >
                <i className="hgi hgi-delete-02" />
              </button>
            </TooltipTrigger>
            <TooltipContent>إلغاء التفعيل</TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ]

  const meta = data?.meta

  return (
    <div className="space-y-6">
      <PageHeader
        title="بطاقات الإهداء"
        description="إدارة بطاقات الإهداء"
        actions={
          <Link to="/gift-cards/new">
            <Button>
              <i className="hgi hgi-add-01 me-1" />
              بطاقة جديدة
            </Button>
          </Link>
        }
      />

      <StatsGrid stats={statCards} loading={isLoading} />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        onReset={() => {
          setSearch('')
          setQuery({ page: 1, perPage: 20 })
        }}
        placeholder="بحث بالكود..."
      >
        <select
          value={query.status ?? ''}
          onChange={(e) =>
            setQuery((q) => ({
              ...q,
              page: 1,
              status: (e.target.value || undefined) as
                | GiftCardStatusFilter
                | undefined,
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
      </FilterBar>

      <DataTable<GiftCardListItem>
        columns={columns}
        data={items}
        keyExtractor={(g) => g.id}
        loading={isLoading}
        emptyMessage="لا توجد بطاقات إهداء"
      />

      {meta && meta.totalPages > 1 && (
        <div className="glass rounded-[var(--radius)] p-3 flex items-center justify-between">
          <span className="text-xs text-[var(--muted)]">
            صفحة {meta.page} من {meta.totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasPreviousPage}
              onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) - 1 }))}
            >
              السابق
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasNextPage}
              onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))}
            >
              التالي
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
