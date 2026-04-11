import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import type { GroupListQuery, GroupListItem } from '@carekit/api-client'
import { useGroups } from '@/hooks/use-groups'
import { PageHeader } from '@/components/shared/page-header'
import { StatsGrid } from '@/components/shared/stats-grid'
import { FilterBar } from '@/components/shared/filter-bar'
import { DataTable } from '@/components/shared/data-table'
import { SkeletonPage } from '@/components/shared/skeleton-page'

export const Route = createFileRoute('/_dashboard/group-sessions/')({
  component: GroupSessionsPage,
})

const STATUS_LABELS: Record<string, string> = {
  active: 'نشط',
  completed: 'مكتمل',
  cancelled: 'ملغى',
}

function statusClass(status: string) {
  if (status === 'active')
    return 'bg-[var(--success-bg)] text-[var(--success)] border border-[color:var(--success)]/30'
  if (status === 'completed')
    return 'bg-[var(--primary-ultra)] text-[var(--primary)] border border-[color:var(--primary)]/20'
  return 'bg-[var(--surface)] text-[var(--muted)] border border-[var(--border-soft)]'
}

function GroupSessionsPage() {
  const [query, setQuery] = useState<GroupListQuery>({ page: 1, perPage: 20 })

  const listQuery = useGroups(query)

  if (listQuery.isLoading) {
    return <SkeletonPage />
  }

  const groups = listQuery.data?.items ?? []
  const meta = listQuery.data?.meta

  const totalEnrolled = groups.reduce((sum, g) => sum + g.enrolledCount, 0)
  const totalCapacity = groups.reduce((sum, g) => sum + g.maxCapacity, 0)

  const statCards = [
    { label: 'إجمالي المجموعات', value: meta?.total ?? 0, icon: 'hgi-user-group', variant: 'primary' as const },
    { label: 'نشطة (هذه الصفحة)', value: groups.filter(g => g.status === 'active').length, icon: 'hgi-checkmark-circle-02', variant: 'success' as const },
    { label: 'المسجّلون', value: totalEnrolled, icon: 'hgi-user-multiple-02', variant: 'accent' as const },
    { label: 'السعة الكلية', value: totalCapacity, icon: 'hgi-hierarchy-01', variant: 'warning' as const },
  ]

  const formatDate = (date: string | undefined) =>
    date
      ? new Date(date).toLocaleDateString('ar-SA', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '—'

  const columns = [
    {
      key: 'name',
      header: 'الاسم',
      render: (g: GroupListItem) => (
        <span className="font-medium text-[var(--fg)]">{g.nameAr}</span>
      ),
    },
    {
      key: 'service',
      header: 'الخدمة',
      render: (g: GroupListItem) => (
        <span className="text-[var(--muted)]">{g.service.nameAr}</span>
      ),
    },
    {
      key: 'practitioner',
      header: 'المختص',
      render: (g: GroupListItem) => (
        <span className="text-[var(--fg-2)]">
          {g.practitioner.user.firstName} {g.practitioner.user.lastName}
        </span>
      ),
    },
    {
      key: 'capacity',
      header: 'الطاقة',
      render: (g: GroupListItem) => (
        <span className="text-[var(--fg-2)]">
          {g.enrolledCount}/{g.maxCapacity}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (g: GroupListItem) => (
        <span
          className={`inline-flex rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium ${statusClass(g.status)}`}
        >
          {STATUS_LABELS[g.status] ?? g.status}
        </span>
      ),
    },
    {
      key: 'startDate',
      header: 'تاريخ البدء',
      render: (g: GroupListItem) => formatDate(g.startDate),
    },
    {
      key: 'endDate',
      header: 'تاريخ الانتهاء',
      render: (g: GroupListItem) => formatDate(g.endDate),
    },
  ]

  const handleSearch = (search: string) => {
    setQuery((q) => ({ ...q, search: search || undefined, page: 1 }))
  }

  const handleReset = () => {
    setQuery({ page: 1, perPage: 20 })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="جلسات المجموعات"
        description="عرض جلسات المجموعات العلاجية"
      />

      <StatsGrid stats={statCards} loading={listQuery.isLoading} />

      <FilterBar
        search={query.search ?? ''}
        onSearchChange={handleSearch}
        onReset={handleReset}
        placeholder="ابحث باسم المجموعة..."
      >
        <select
          value={query.status ?? ''}
          onChange={(e) =>
            setQuery((q) => ({
              ...q,
              status: (e.target.value as GroupListQuery['status']) || undefined,
              page: 1,
            }))
          }
          className="h-9 rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-solid)] text-sm text-[var(--fg)] px-3"
        >
          <option value="">الكل</option>
          <option value="active">نشط</option>
          <option value="completed">مكتمل</option>
          <option value="cancelled">ملغى</option>
        </select>
      </FilterBar>

      <DataTable
        columns={columns}
        data={groups}
        keyExtractor={(g) => g.id}
        loading={listQuery.isFetching}
        emptyMessage="لا توجد مجموعات"
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
