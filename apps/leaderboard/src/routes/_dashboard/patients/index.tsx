import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { PatientListItem, PatientListQuery } from '@carekit/api-client'
import { usePatientStats, usePatients } from '@/hooks/use-patients'
import { PageHeader } from '@/components/shared/page-header'
import { StatsGrid } from '@/components/shared/stats-grid'
import { FilterBar } from '@/components/shared/filter-bar'
import { DataTable } from '@/components/shared/data-table'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { HIcon } from '@/components/shared/hicon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export const Route = createFileRoute('/_dashboard/patients/')({
  component: PatientsListPage,
})

function PatientsListPage() {
  const [query, setQuery] = useState<PatientListQuery>({ page: 1, perPage: 20 })

  const statsQuery = usePatientStats()
  const listQuery = usePatients(query)

  if (statsQuery.isLoading || listQuery.isLoading) {
    return <SkeletonPage />
  }

  const stats = statsQuery.data
  const data = listQuery.data
  const patients = data?.items ?? []
  const meta = data?.meta

  const statCards = [
    {
      label: 'إجمالي المرضى',
      value: stats?.total ?? 0,
      icon: 'hgi-user-multiple-02',
      variant: 'primary' as const,
    },
    {
      label: 'نشطون',
      value: stats?.active ?? 0,
      icon: 'hgi-user-check-01',
      variant: 'success' as const,
    },
    {
      label: 'حضور مباشر',
      value: stats?.walkIn ?? 0,
      icon: 'hgi-walking',
      variant: 'warning' as const,
    },
    {
      label: 'جدد هذا الأسبوع',
      value: stats?.newThisWeek ?? 0,
      icon: 'hgi-user-add-01',
      variant: 'accent' as const,
    },
  ]

  const columns = [
    {
      key: 'name',
      header: 'الاسم',
      render: (p: PatientListItem) => (
        <span className="font-medium text-[var(--fg)]">
          {p.firstName} {p.lastName}
        </span>
      ),
    },
    {
      key: 'phone',
      header: 'الهاتف',
      render: (p: PatientListItem) => (
        <span className="text-[var(--muted)]">{p.phone ?? '—'}</span>
      ),
    },
    {
      key: 'email',
      header: 'البريد',
      render: (p: PatientListItem) => (
        <span className="text-[var(--muted)]">{p.email ?? '—'}</span>
      ),
    },
    {
      key: 'gender',
      header: 'الجنس',
      render: (p: PatientListItem) =>
        p.gender === 'male' ? 'ذكر' : p.gender === 'female' ? 'أنثى' : '—',
    },
    {
      key: 'bookings',
      header: 'الحجوزات',
      render: (p: PatientListItem) => p.totalBookings,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (p: PatientListItem) =>
        p.isActive ? (
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
      header: 'تاريخ التسجيل',
      render: (p: PatientListItem) =>
        new Date(p.createdAt).toLocaleDateString('ar-SA', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
    },
    {
      key: 'actions',
      header: '',
      render: (p: PatientListItem) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/patients/$id"
              params={{ id: p.id }}
              className="inline-flex items-center justify-center size-7 rounded-sm hover:bg-[var(--surface)] text-[var(--fg-2)] transition-colors"
            >
              <HIcon name="hgi-eye" />
            </Link>
          </TooltipTrigger>
          <TooltipContent>عرض التفاصيل</TooltipContent>
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
        title="المرضى"
        description="إدارة سجلات المرضى"
        actions={
          <Link to="/patients/new">
            <Button>
              <HIcon name="hgi-add-01" className="me-2" />
              مريض جديد
            </Button>
          </Link>
        }
      />

      <StatsGrid stats={statCards} loading={statsQuery.isLoading} />

      <FilterBar
        search={query.search ?? ''}
        onSearchChange={handleSearch}
        onReset={handleReset}
        placeholder="ابحث بالاسم أو الهاتف..."
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
        data={patients}
        keyExtractor={(p) => p.id}
        loading={listQuery.isFetching}
        emptyMessage="لا يوجد مرضى"
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
