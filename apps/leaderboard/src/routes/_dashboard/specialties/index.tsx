import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { SpecialtyListItem } from '@carekit/api-client'
import { useSpecialties } from '@/hooks/use-specialties'
import { PageHeader } from '@/components/shared/page-header'
import { StatsGrid } from '@/components/shared/stats-grid'
import { FilterBar } from '@/components/shared/filter-bar'
import { DataTable } from '@/components/shared/data-table'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { HIcon } from '@/components/shared/hicon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export const Route = createFileRoute('/_dashboard/specialties/')({
  component: SpecialtiesListPage,
})

function SpecialtiesListPage() {
  const [search, setSearch] = useState('')
  const listQuery = useSpecialties()

  if (listQuery.isLoading) return <SkeletonPage />

  const all = listQuery.data ?? []
  const filtered = search.trim()
    ? all.filter(
        (s) =>
          s.nameAr.toLowerCase().includes(search.toLowerCase()) ||
          s.nameEn.toLowerCase().includes(search.toLowerCase()),
      )
    : all

  const total = all.length
  const active = all.filter((s) => s.isActive).length
  const withIcon = all.filter((s) => !!s.iconUrl).length

  const statCards = [
    {
      label: 'إجمالي التخصصات',
      value: total,
      icon: 'hgi-medical-mask',
      variant: 'primary' as const,
    },
    {
      label: 'نشطة',
      value: active,
      icon: 'hgi-checkmark-circle-02',
      variant: 'success' as const,
    },
    {
      label: 'بدون أيقونة',
      value: total - withIcon,
      icon: 'hgi-image-not-found-01',
      variant: 'warning' as const,
    },
    {
      label: 'في النتائج',
      value: filtered.length,
      icon: 'hgi-search-01',
      variant: 'accent' as const,
    },
  ]

  const columns = [
    {
      key: 'name',
      header: 'الاسم',
      render: (s: SpecialtyListItem) => (
        <span className="font-medium text-[var(--fg)]">{s.nameAr}</span>
      ),
    },
    {
      key: 'nameEn',
      header: 'الاسم (إنجليزي)',
      render: (s: SpecialtyListItem) => (
        <span className="text-[var(--muted)]">{s.nameEn}</span>
      ),
    },
    {
      key: 'description',
      header: 'الوصف',
      render: (s: SpecialtyListItem) => (
        <span className="text-[var(--muted)]">{s.descriptionAr ?? '—'}</span>
      ),
    },
    {
      key: 'sortOrder',
      header: 'الترتيب',
      render: (s: SpecialtyListItem) => s.sortOrder,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (s: SpecialtyListItem) =>
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
      render: (s: SpecialtyListItem) =>
        new Date(s.createdAt).toLocaleDateString('ar-SA', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
    },
    {
      key: 'actions',
      header: '',
      render: (s: SpecialtyListItem) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/specialties/$id"
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="التخصصات"
        description="إدارة تخصصات الممارسين"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <HIcon name="hgi-download-02" className="me-2" />
              تصدير
            </Button>
            <Link to="/specialties/new">
              <Button>
                <HIcon name="hgi-add-01" className="me-2" />
                تخصص جديد
              </Button>
            </Link>
          </div>
        }
      />

      <StatsGrid stats={statCards} loading={listQuery.isLoading} />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        onReset={() => setSearch('')}
        placeholder="ابحث باسم التخصص..."
      />

      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={(s) => s.id}
        loading={listQuery.isFetching}
        emptyMessage="لا توجد تخصصات"
      />
    </div>
  )
}
