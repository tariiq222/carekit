import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { DepartmentListItem, DepartmentListQuery } from '@carekit/api-client'
import { useDepartments } from '@/hooks/use-departments'
import { PageHeader } from '@/components/shared/page-header'
import { StatsGrid } from '@/components/shared/stats-grid'
import { FilterBar } from '@/components/shared/filter-bar'
import { DataTable } from '@/components/shared/data-table'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { HIcon } from '@/components/shared/hicon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export const Route = createFileRoute('/_dashboard/departments/')({
  component: DepartmentsListPage,
})

function DepartmentsListPage() {
  const [query, setQuery] = useState<DepartmentListQuery>({ page: 1, perPage: 20 })

  const listQuery = useDepartments(query)

  if (listQuery.isLoading) return <SkeletonPage />

  const data = listQuery.data
  const departments = data?.items ?? []
  const meta = data?.meta

  const total = meta?.total ?? 0
  const active = departments.filter((d) => d.isActive).length
  const inactive = departments.filter((d) => !d.isActive).length

  const statCards = [
    {
      label: 'إجمالي الأقسام',
      value: total,
      icon: 'hgi-folder-02',
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
      label: 'في هذه الصفحة',
      value: departments.length,
      icon: 'hgi-layers-01',
      variant: 'accent' as const,
    },
  ]

  const columns = [
    {
      key: 'name',
      header: 'الاسم',
      render: (d: DepartmentListItem) => (
        <span className="font-medium text-[var(--fg)]">{d.nameAr}</span>
      ),
    },
    {
      key: 'nameEn',
      header: 'الاسم (إنجليزي)',
      render: (d: DepartmentListItem) => (
        <span className="text-[var(--muted)]">{d.nameEn}</span>
      ),
    },
    {
      key: 'description',
      header: 'الوصف',
      render: (d: DepartmentListItem) => (
        <span className="text-[var(--muted)]">{d.descriptionAr ?? '—'}</span>
      ),
    },
    {
      key: 'sortOrder',
      header: 'الترتيب',
      render: (d: DepartmentListItem) => d.sortOrder,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (d: DepartmentListItem) =>
        d.isActive ? (
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
      render: (d: DepartmentListItem) =>
        new Date(d.createdAt).toLocaleDateString('ar-SA', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
    },
    {
      key: 'actions',
      header: '',
      render: (d: DepartmentListItem) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/departments/$id"
              params={{ id: d.id }}
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
        title="الأقسام"
        description="إدارة أقسام العيادة"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <HIcon name="hgi-download-02" className="me-2" />
              تصدير
            </Button>
            <Link to="/departments/new">
              <Button>
                <HIcon name="hgi-add-01" className="me-2" />
                قسم جديد
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
        placeholder="ابحث باسم القسم..."
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
        data={departments}
        keyExtractor={(d) => d.id}
        loading={listQuery.isFetching}
        emptyMessage="لا توجد أقسام"
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
