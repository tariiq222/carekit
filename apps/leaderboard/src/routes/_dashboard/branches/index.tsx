import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { BranchListItem, BranchListQuery } from '@carekit/api-client'
import { useBranches } from '@/hooks/use-branches'
import { PageHeader } from '@/components/shared/page-header'
import { StatsGrid } from '@/components/shared/stats-grid'
import { FilterBar } from '@/components/shared/filter-bar'
import { DataTable } from '@/components/shared/data-table'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { HIcon } from '@/components/shared/hicon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export const Route = createFileRoute('/_dashboard/branches/')({
  component: BranchesListPage,
})

function BranchesListPage() {
  const [query, setQuery] = useState<BranchListQuery>({ page: 1, perPage: 20 })

  const listQuery = useBranches(query)

  if (listQuery.isLoading) return <SkeletonPage />

  const data = listQuery.data
  const branches = data?.items ?? []
  const meta = data?.meta

  const total = meta?.total ?? 0
  const active = branches.filter((b) => b.isActive).length
  const inactive = branches.filter((b) => !b.isActive).length
  const main = branches.filter((b) => b.isMain).length

  const statCards = [
    {
      label: 'إجمالي الفروع',
      value: total,
      icon: 'hgi-building-03',
      variant: 'primary' as const,
    },
    {
      label: 'نشطة',
      value: active,
      icon: 'hgi-checkmark-circle-02',
      variant: 'success' as const,
    },
    {
      label: 'غير نشطة',
      value: inactive,
      icon: 'hgi-cancel-circle',
      variant: 'warning' as const,
    },
    {
      label: 'الفرع الرئيسي',
      value: main,
      icon: 'hgi-star',
      variant: 'accent' as const,
    },
  ]

  const columns = [
    {
      key: 'name',
      header: 'الاسم',
      render: (b: BranchListItem) => (
        <span className="font-medium text-[var(--fg)]">{b.nameAr}</span>
      ),
    },
    {
      key: 'address',
      header: 'العنوان',
      render: (b: BranchListItem) => (
        <span className="text-[var(--muted)]">{b.address ?? '—'}</span>
      ),
    },
    {
      key: 'phone',
      header: 'الهاتف',
      render: (b: BranchListItem) => (
        <span className="text-[var(--muted)]">{b.phone ?? '—'}</span>
      ),
    },
    {
      key: 'main',
      header: 'النوع',
      render: (b: BranchListItem) =>
        b.isMain ? (
          <span className="inline-flex rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium bg-[var(--accent-ultra)] text-[var(--accent-dark)] border border-[color:var(--accent)]/30">
            رئيسي
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (b: BranchListItem) =>
        b.isActive ? (
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
      render: (b: BranchListItem) =>
        new Date(b.createdAt).toLocaleDateString('ar-SA', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
    },
    {
      key: 'actions',
      header: '',
      render: (b: BranchListItem) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/branches/$id"
              params={{ id: b.id }}
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

  const handleReset = () => setQuery({ page: 1, perPage: 20 })

  return (
    <div className="space-y-6">
      <PageHeader
        title="الفروع"
        description="إدارة الفروع الفعلية للعيادة"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <HIcon name="hgi-download-02" className="me-2" />
              تصدير
            </Button>
            <Link to="/branches/new">
              <Button>
                <HIcon name="hgi-add-01" className="me-2" />
                فرع جديد
              </Button>
            </Link>
          </div>
        }
      />

      <StatsGrid stats={statCards} loading={listQuery.isLoading} />

      <FilterBar
        search={query.search ?? ''}
        onSearchChange={handleSearch}
        onReset={handleReset}
        placeholder="ابحث باسم الفرع أو العنوان..."
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
        data={branches}
        keyExtractor={(b) => b.id}
        loading={listQuery.isFetching}
        emptyMessage="لا توجد فروع"
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
              onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))}
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
