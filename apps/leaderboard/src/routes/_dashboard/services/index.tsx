import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { ServiceListItem, ServiceListQuery } from '@carekit/api-client'
import { useServices, useServiceStats } from '@/hooks/use-services'
import { PageHeader } from '@/components/shared/page-header'
import { StatsGrid } from '@/components/shared/stats-grid'
import { FilterBar } from '@/components/shared/filter-bar'
import { DataTable } from '@/components/shared/data-table'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { HIcon } from '@/components/shared/hicon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export const Route = createFileRoute('/_dashboard/services/')({
  component: ServicesListPage,
})

function ServicesListPage() {
  const [query, setQuery] = useState<ServiceListQuery>({ page: 1, perPage: 20 })

  const statsQuery = useServiceStats()
  const listQuery = useServices(query)

  if (statsQuery.isLoading || listQuery.isLoading) {
    return <SkeletonPage />
  }

  const stats = statsQuery.data
  const data = listQuery.data
  const services = data?.items ?? []
  const meta = data?.meta

  const statCards = [
    {
      label: 'إجمالي الخدمات',
      value: stats?.total ?? 0,
      icon: 'hgi-stethoscope',
      variant: 'primary' as const,
    },
    {
      label: 'نشطة',
      value: stats?.active ?? 0,
      icon: 'hgi-checkmark-circle-02',
      variant: 'success' as const,
    },
    {
      label: 'غير نشطة',
      value: stats?.inactive ?? 0,
      icon: 'hgi-cancel-circle',
      variant: 'warning' as const,
    },
    {
      label: 'إجمالي الفئات',
      value: services.length,
      icon: 'hgi-folder-02',
      variant: 'accent' as const,
    },
  ]

  const formatPrice = (halalat: number) =>
    `${(halalat / 100).toLocaleString('ar-SA')} ر.س`

  const columns = [
    {
      key: 'name',
      header: 'الاسم',
      render: (s: ServiceListItem) => (
        <span className="font-medium text-[var(--fg)]">{s.nameAr}</span>
      ),
    },
    {
      key: 'category',
      header: 'التصنيف',
      render: (s: ServiceListItem) => (
        <span className="text-[var(--muted)]">{s.category?.nameAr ?? '—'}</span>
      ),
    },
    {
      key: 'price',
      header: 'السعر',
      render: (s: ServiceListItem) => formatPrice(s.price),
    },
    {
      key: 'duration',
      header: 'المدة',
      render: (s: ServiceListItem) => `${s.duration} د`,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (s: ServiceListItem) =>
        s.isActive ? (
          <span className="inline-flex rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium bg-[var(--success-bg)] text-[var(--success)] border border-[color:var(--success)]/30">
            نشط
          </span>
        ) : (
          <span className="inline-flex rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium bg-[var(--surface)] text-[var(--muted)] border border-[var(--border-soft)]">
            غير نشط
          </span>
        ),
    },
    {
      key: 'createdAt',
      header: 'تاريخ الإنشاء',
      render: (s: ServiceListItem) =>
        new Date(s.createdAt).toLocaleDateString('ar-SA', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
    },
    {
      key: 'actions',
      header: '',
      render: (s: ServiceListItem) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/services/$id"
              params={{ id: s.id }}
              className="inline-flex items-center justify-center size-7 rounded-sm hover:bg-[var(--surface)] text-[var(--fg-2)] transition-colors"
            >
              <HIcon name="hgi-edit-02" />
            </Link>
          </TooltipTrigger>
          <TooltipContent>تعديل</TooltipContent>
        </Tooltip>
      ),
    },
  ]

  const handleStatusChange = (value: string) => {
    const isActive =
      value === '' ? undefined : value === 'true' ? true : false
    setQuery((q) => ({ ...q, isActive, page: 1 }))
  }

  const handleSearch = (search: string) => {
    setQuery((q) => ({ ...q, search: search || undefined, page: 1 }))
  }

  const handleReset = () => {
    setQuery({ page: 1, perPage: 20 })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="الخدمات"
        description="إدارة كتالوج خدمات العيادة"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <HIcon name="hgi-download-02" className="me-2" />
              تصدير
            </Button>
            <Link to="/services/new">
              <Button>
                <HIcon name="hgi-add-01" className="me-2" />
                خدمة جديدة
              </Button>
            </Link>
          </div>
        }
      />

      <StatsGrid stats={statCards} loading={statsQuery.isLoading} />

      <FilterBar
        search={query.search ?? ''}
        onSearchChange={handleSearch}
        onReset={handleReset}
        placeholder="ابحث باسم الخدمة..."
      >
        <select
          value={
            query.isActive === undefined ? '' : query.isActive ? 'true' : 'false'
          }
          onChange={(e) => handleStatusChange(e.target.value)}
          className="h-9 rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-solid)] text-sm text-[var(--fg)] px-3"
        >
          <option value="">الكل</option>
          <option value="true">نشط</option>
          <option value="false">غير نشط</option>
        </select>
      </FilterBar>

      <DataTable
        columns={columns}
        data={services}
        keyExtractor={(s) => s.id}
        loading={listQuery.isFetching}
        emptyMessage="لا توجد خدمات"
      />

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--muted)]">
            الصفحة {meta.page} من {meta.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setQuery((q) => ({ ...q, page: Math.max(1, (q.page ?? 1) - 1) }))
              }
              disabled={meta.page <= 1}
              className="glass h-9 px-4 rounded-[var(--radius-sm)] text-sm text-[var(--fg)] disabled:opacity-50"
            >
              السابق
            </button>
            <button
              onClick={() =>
                setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))
              }
              disabled={meta.page >= meta.totalPages}
              className="glass h-9 px-4 rounded-[var(--radius-sm)] text-sm text-[var(--fg)] disabled:opacity-50"
            >
              التالي
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
