import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { IntakeFormListItem, IntakeFormListQuery } from '@carekit/api-client'
import { useIntakeForms, useDeleteIntakeForm } from '@/hooks/use-intake-forms'
import { PageHeader } from '@/components/shared/page-header'
import { StatsGrid } from '@/components/shared/stats-grid'
import { FilterBar } from '@/components/shared/filter-bar'
import { DataTable } from '@/components/shared/data-table'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export const Route = createFileRoute('/_dashboard/intake-forms/')({
  component: IntakeFormsListPage,
})

const FORM_TYPE_LABELS: Record<string, string> = {
  pre_booking: 'قبل الحجز',
  pre_session: 'قبل الجلسة',
  post_session: 'بعد الجلسة',
  registration: 'تسجيل',
}

const FORM_SCOPE_LABELS: Record<string, string> = {
  global: 'عام',
  service: 'خدمة',
  practitioner: 'ممارس',
  branch: 'فرع',
}

function IntakeFormsListPage() {
  const [query, setQuery] = useState<IntakeFormListQuery>({ page: 1, perPage: 20 })
  const listQuery = useIntakeForms(query)
  const deleteMutation = useDeleteIntakeForm()

  if (listQuery.isLoading) return <SkeletonPage />

  const items = listQuery.data?.items ?? []
  const meta = listQuery.data?.meta

  const total = items.length
  const active = items.filter((f) => f.isActive).length
  const inactive = total - active
  const globalCount = items.filter((f) => f.scope === 'global').length

  const statCards = [
    { label: 'إجمالي النماذج', value: total, icon: 'hgi-document-code', variant: 'primary' as const },
    { label: 'نشطة', value: active, icon: 'hgi-checkmark-circle-02', variant: 'success' as const },
    { label: 'غير نشطة', value: inactive, icon: 'hgi-cancel-circle', variant: 'warning' as const },
    { label: 'نطاق عام', value: globalCount, icon: 'hgi-global', variant: 'accent' as const },
  ]

  const columns = [
    {
      key: 'name',
      header: 'الاسم',
      render: (f: IntakeFormListItem) => (
        <span className="font-medium text-[var(--fg)]">{f.nameAr}</span>
      ),
    },
    {
      key: 'type',
      header: 'النوع',
      render: (f: IntakeFormListItem) => (
        <span className="text-[var(--muted)]">{FORM_TYPE_LABELS[f.type] ?? f.type}</span>
      ),
    },
    {
      key: 'scope',
      header: 'النطاق',
      render: (f: IntakeFormListItem) => (
        <span className="text-[var(--muted)]">{FORM_SCOPE_LABELS[f.scope] ?? f.scope}</span>
      ),
    },
    {
      key: 'fieldCount',
      header: 'الحقول',
      render: (f: IntakeFormListItem) => (
        <span className="text-[var(--muted)]">{f.fieldCount}</span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (f: IntakeFormListItem) =>
        f.isActive ? (
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
      render: (f: IntakeFormListItem) =>
        new Date(f.createdAt).toLocaleDateString('ar-SA', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
    },
    {
      key: 'actions',
      header: '',
      render: (f: IntakeFormListItem) => (
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/intake-forms/$id"
                params={{ id: f.id }}
                className="inline-flex items-center justify-center size-9 rounded-[var(--radius-sm)] hover:bg-[var(--surface)] text-[var(--fg-2)] transition-colors"
              >
                <i className="hgi-stroke hgi-edit-02" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>تعديل</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  if (confirm('حذف النموذج؟')) deleteMutation.mutate(f.id)
                }}
                className="inline-flex items-center justify-center size-9 rounded-[var(--radius-sm)] hover:bg-[var(--error-bg,#fef2f2)] text-[var(--muted)] hover:text-[var(--error,#dc2626)] transition-colors"
              >
                <i className="hgi-stroke hgi-delete-02" />
              </button>
            </TooltipTrigger>
            <TooltipContent>حذف</TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="نماذج الاستقبال"
        description="إدارة نماذج المعلومات المرتبطة بالحجوزات والجلسات"
        actions={
          <Link to="/intake-forms/new">
            <Button>
              <i className="hgi-stroke hgi-add-01 me-2" />
              نموذج جديد
            </Button>
          </Link>
        }
      />

      <StatsGrid stats={statCards} loading={listQuery.isLoading} />

      <FilterBar
        search={query.search ?? ''}
        onSearchChange={(s) => setQuery((q) => ({ ...q, search: s || undefined, page: 1 }))}
        onReset={() => setQuery({ page: 1, perPage: 20 })}
        placeholder="ابحث باسم النموذج..."
      />

      <DataTable
        columns={columns}
        data={items}
        keyExtractor={(f) => f.id}
        loading={listQuery.isFetching}
        emptyMessage="لا توجد نماذج"
      />

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--muted)]">
            الصفحة {meta.page} من {meta.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuery((q) => ({ ...q, page: Math.max(1, (q.page ?? 1) - 1) }))}
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
