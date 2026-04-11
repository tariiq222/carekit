import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import type {
  PractitionerListItem,
  PractitionerListQuery,
} from '@carekit/api-client'
import { PageHeader } from '@/components/shared/page-header'
import { StatsGrid } from '@/components/shared/stats-grid'
import { FilterBar } from '@/components/shared/filter-bar'
import { DataTable } from '@/components/shared/data-table'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  usePractitioners,
  usePractitionerStats,
} from '@/hooks/use-practitioners'

export const Route = createFileRoute('/_dashboard/practitioners/')({
  component: PractitionersListPage,
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

function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <span className="inline-flex rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium bg-[var(--success-bg)] text-[var(--success)] border border-[color:var(--success)]/30">
        نشط
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium bg-[var(--surface)] text-[var(--muted)] border border-[var(--border-soft)]">
      غير نشط
    </span>
  )
}

function PractitionersListPage() {
  const [query, setQuery] = useState<PractitionerListQuery>({
    page: 1,
    perPage: 20,
  })
  const [search, setSearch] = useState('')

  const { data: stats, isLoading: statsLoading } = usePractitionerStats()
  const { data, isLoading } = usePractitioners(query)

  if (isLoading && !data) return <SkeletonPage />

  const statCards = [
    {
      label: 'إجمالي الممارسين',
      value: stats?.total ?? 0,
      icon: 'hgi-doctor-01',
      variant: 'primary' as const,
    },
    {
      label: 'نشطون',
      value: stats?.active ?? 0,
      icon: 'hgi-user-check-01',
      variant: 'success' as const,
    },
    {
      label: 'غير نشطين',
      value: stats?.inactive ?? 0,
      icon: 'hgi-user-remove-01',
      variant: 'warning' as const,
    },
    {
      label: 'هذا الشهر',
      value: stats?.newThisMonth ?? 0,
      icon: 'hgi-user-add-01',
      variant: 'accent' as const,
    },
  ]

  const columns = [
    {
      key: 'name',
      header: 'الاسم',
      render: (p: PractitionerListItem) =>
        `${p.user.firstName} ${p.user.lastName}`,
    },
    {
      key: 'specialty',
      header: 'التخصص',
      render: (p: PractitionerListItem) => (
        <span className="text-[var(--muted)]">{p.specialty.nameAr}</span>
      ),
    },
    {
      key: 'email',
      header: 'البريد',
      render: (p: PractitionerListItem) => (
        <span className="text-[var(--muted)]">{p.user.email}</span>
      ),
    },
    {
      key: 'experience',
      header: 'الخبرة',
      render: (p: PractitionerListItem) => `${p.experience} سنة`,
    },
    {
      key: 'rating',
      header: 'التقييم',
      render: (p: PractitionerListItem) =>
        `★ ${p.rating.toFixed(1)} (${p.reviewCount})`,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (p: PractitionerListItem) => <StatusBadge isActive={p.isActive} />,
    },
    {
      key: 'createdAt',
      header: 'تاريخ الانضمام',
      render: (p: PractitionerListItem) => formatDate(p.createdAt),
    },
    {
      key: 'actions',
      header: '',
      render: (p: PractitionerListItem) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/practitioners/$id"
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
      <PageHeader
        title="الممارسون"
        description="إدارة الممارسين الصحيين"
        actions={
          <Link to="/practitioners/new">
            <Button>
              <i className="hgi hgi-add-01 me-1" />
              ممارس جديد
            </Button>
          </Link>
        }
      />

      <StatsGrid stats={statCards} loading={statsLoading} />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        onReset={() => {
          setSearch('')
          setQuery({ page: 1, perPage: 20 })
        }}
        placeholder="بحث في الممارسين..."
      >
        <select
          value={
            query.isActive === undefined ? '' : query.isActive ? 'true' : 'false'
          }
          onChange={(e) => {
            const v = e.target.value
            setQuery((q) => ({
              ...q,
              page: 1,
              isActive: v === '' ? undefined : v === 'true',
            }))
          }}
          className="h-9 rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-solid)] text-sm text-[var(--fg)] px-3"
        >
          <option value="">الكل</option>
          <option value="true">نشط</option>
          <option value="false">غير نشط</option>
        </select>
      </FilterBar>

      <DataTable<PractitionerListItem>
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(p) => p.id}
        loading={isLoading}
        emptyMessage="لا يوجد ممارسون"
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
              onClick={() =>
                setQuery((q) => ({ ...q, page: (q.page ?? 1) - 1 }))
              }
            >
              السابق
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasNextPage}
              onClick={() =>
                setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))
              }
            >
              التالي
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
