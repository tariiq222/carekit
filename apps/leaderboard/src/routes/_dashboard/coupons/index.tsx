import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import type {
  CouponListItem,
  CouponListQuery,
  CouponStatusFilter,
} from '@carekit/api-client'
import { PageHeader } from '@/components/shared/page-header'
import { StatsGrid } from '@/components/shared/stats-grid'
import { FilterBar } from '@/components/shared/filter-bar'
import { DataTable } from '@/components/shared/data-table'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { HIcon } from '@/components/shared/hicon'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useCoupons, useDeleteCoupon } from '@/hooks/use-coupons'

export const Route = createFileRoute('/_dashboard/coupons/')({
  component: CouponsListPage,
})

const STATUS_OPTIONS: Array<{ value: '' | CouponStatusFilter; label: string }> = [
  { value: '', label: 'كل الحالات' },
  { value: 'active', label: 'فعال' },
  { value: 'inactive', label: 'غير فعال' },
  { value: 'expired', label: 'منتهي' },
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

function formatDiscount(c: CouponListItem): string {
  if (c.discountType === 'percentage') return `${c.discountValue}%`
  return `${(c.discountValue / 100).toLocaleString('ar-SA')} ر.س`
}

function statusBadge(c: CouponListItem) {
  const expired = c.expiresAt && new Date(c.expiresAt) < new Date()
  if (expired) {
    return (
      <span className="inline-flex items-center rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--muted)]">
        منتهي
      </span>
    )
  }
  if (!c.isActive) {
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

function CouponsListPage() {
  const [query, setQuery] = useState<CouponListQuery>({ page: 1, perPage: 20 })
  const [search, setSearch] = useState('')

  const { data, isLoading } = useCoupons({ ...query, search: search || undefined })
  const deleteMutation = useDeleteCoupon()

  if (isLoading && !data) return <SkeletonPage />

  const items = data?.items ?? []
  const now = new Date()
  const total = items.length
  const active = items.filter(
    (c) => c.isActive && (!c.expiresAt || new Date(c.expiresAt) >= now),
  ).length
  const expired = items.filter(
    (c) => c.expiresAt && new Date(c.expiresAt) < now,
  ).length
  const totalUses = items.reduce((acc, c) => acc + c.usedCount, 0)

  const statCards = [
    {
      label: 'إجمالي الكوبونات',
      value: data?.meta.total ?? total,
      icon: 'hgi-tag-01',
      variant: 'primary' as const,
    },
    {
      label: 'فعّالة',
      value: active,
      icon: 'hgi-tick-double-01',
      variant: 'success' as const,
    },
    {
      label: 'منتهية',
      value: expired,
      icon: 'hgi-hourglass',
      variant: 'warning' as const,
    },
    {
      label: 'مرات الاستخدام',
      value: totalUses,
      icon: 'hgi-chart-line-data-01',
      variant: 'accent' as const,
    },
  ]

  const handleDelete = (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الكوبون؟')) return
    deleteMutation.mutate(id)
  }

  const columns = [
    {
      key: 'code',
      header: 'الكود',
      render: (c: CouponListItem) => (
        <span className="font-mono text-[var(--fg)]">{c.code}</span>
      ),
    },
    {
      key: 'type',
      header: 'النوع',
      render: (c: CouponListItem) =>
        c.discountType === 'percentage' ? 'نسبة' : 'مبلغ ثابت',
    },
    {
      key: 'value',
      header: 'القيمة',
      render: (c: CouponListItem) => formatDiscount(c),
    },
    {
      key: 'usage',
      header: 'الاستخدام',
      render: (c: CouponListItem) =>
        c.maxUses ? `${c.usedCount} / ${c.maxUses}` : `${c.usedCount}`,
    },
    {
      key: 'expiresAt',
      header: 'ينتهي في',
      render: (c: CouponListItem) => formatDate(c.expiresAt),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (c: CouponListItem) => statusBadge(c),
    },
    {
      key: 'actions',
      header: '',
      render: (c: CouponListItem) => (
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/coupons/$id"
                params={{ id: c.id }}
                className="inline-flex items-center justify-center size-7 rounded-sm text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)] transition-colors"
              >
                <HIcon name="hgi-edit-02" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>تعديل</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleDelete(c.id)}
                className="inline-flex items-center justify-center size-7 rounded-sm text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--error,#dc2626)] transition-colors"
              >
                <HIcon name="hgi-delete-02" />
              </button>
            </TooltipTrigger>
            <TooltipContent>حذف</TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ]

  const meta = data?.meta

  return (
    <div className="space-y-6">
      <PageHeader
        title="الكوبونات"
        description="إدارة كوبونات الخصم"
        actions={
          <Link to="/coupons/new">
            <Button>
              <HIcon name="hgi-add-01" className="me-1" />
              كوبون جديد
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
                | CouponStatusFilter
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

      <DataTable<CouponListItem>
        columns={columns}
        data={items}
        keyExtractor={(c) => c.id}
        loading={isLoading}
        emptyMessage="لا توجد كوبونات"
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
