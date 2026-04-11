import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import type { UserListItem, UserListQuery } from '@carekit/api-client'
import { useUsers, useActivateUser, useDeactivateUser, useDeleteUser } from '@/hooks/use-users'
import { PageHeader } from '@/components/shared/page-header'
import { StatsGrid } from '@/components/shared/stats-grid'
import { FilterBar } from '@/components/shared/filter-bar'
import { DataTable } from '@/components/shared/data-table'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { HIcon } from '@/components/shared/hicon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const Route = createFileRoute('/_dashboard/users/')({
  component: UsersListPage,
})

const GENDER_LABELS: Record<string, string> = {
  male: 'ذكر',
  female: 'أنثى',
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <span className="inline-flex rounded-sm px-2 py-0.5 text-xs font-medium bg-success/10 text-success border border-success/30">
        نشط
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-sm px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground border border-border">
      غير نشط
    </span>
  )
}

function UsersListPage() {
  const [query, setQuery] = useState<UserListQuery>({ page: 1, perPage: 20 })

  const { data, isLoading, isFetching } = useUsers(query)
  const activateMut = useActivateUser()
  const deactivateMut = useDeactivateUser()
  const deleteMut = useDeleteUser()

  if (isLoading && !data) return <SkeletonPage />

  const items = data?.items ?? []
  const meta = data?.meta
  const total = meta?.total ?? 0
  const active = items.filter((u) => u.isActive).length
  const inactive = items.filter((u) => !u.isActive).length

  const statCards = [
    { label: 'إجمالي المستخدمين', value: total, icon: 'hgi-user-multiple-02', variant: 'primary' as const },
    { label: 'نشطون', value: active, icon: 'hgi-user-check-01', variant: 'success' as const },
    { label: 'غير نشطين', value: inactive, icon: 'hgi-user-remove-01', variant: 'warning' as const },
    { label: 'أدوار مخصصة', value: items.filter((u) => u.roles.length > 0).length, icon: 'hgi-shield-01', variant: 'accent' as const },
  ]

  const columns = [
    {
      key: 'name',
      header: 'الاسم',
      render: (u: UserListItem) => (
        <span className="font-medium text-foreground">{u.firstName} {u.lastName}</span>
      ),
    },
    {
      key: 'email',
      header: 'البريد الإلكتروني',
      render: (u: UserListItem) => (
        <span className="text-muted-foreground text-xs">{u.email}</span>
      ),
    },
    {
      key: 'phone',
      header: 'الهاتف',
      render: (u: UserListItem) => (
        <span className="text-muted-foreground">{u.phone ?? '—'}</span>
      ),
    },
    {
      key: 'gender',
      header: 'الجنس',
      render: (u: UserListItem) => (
        <span className="text-muted-foreground">{u.gender ? GENDER_LABELS[u.gender] : '—'}</span>
      ),
    },
    {
      key: 'roles',
      header: 'الدور',
      render: (u: UserListItem) =>
        u.roles.length > 0 ? (
          <span className="inline-flex rounded-sm px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20">
            {u.roles[0]?.name}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (u: UserListItem) => <StatusBadge isActive={u.isActive} />,
    },
    {
      key: 'createdAt',
      header: 'تاريخ الإنشاء',
      render: (u: UserListItem) =>
        new Date(u.createdAt).toLocaleDateString('ar-SA', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
    },
    {
      key: 'actions',
      header: '',
      render: (u: UserListItem) => (
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => u.isActive ? deactivateMut.mutate(u.id) : activateMut.mutate(u.id)}
                className="inline-flex items-center justify-center size-7 rounded-sm text-muted-foreground hover:bg-surface-muted hover:text-foreground transition-colors"
              >
                <HIcon name={u.isActive ? 'hgi-cancel-circle' : 'hgi-checkmark-circle-02'} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{u.isActive ? 'إلغاء التفعيل' : 'تفعيل'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => deleteMut.mutate(u.id)}
                className="inline-flex items-center justify-center size-7 rounded-sm text-muted-foreground hover:bg-error/10 hover:text-error transition-colors"
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="المستخدمون"
        description="إدارة حسابات المستخدمين والأدوار"
        actions={
          <Button>
            <HIcon name="hgi-add-01" className="me-1" />
            مستخدم جديد
          </Button>
        }
      />

      <StatsGrid stats={statCards} loading={isFetching} />

      <FilterBar
        search={query.search ?? ''}
        onSearchChange={(s) => setQuery((q) => ({ ...q, search: s || undefined, page: 1 }))}
        onReset={() => setQuery({ page: 1, perPage: 20 })}
        placeholder="بحث بالاسم أو البريد..."
      >
        <Select
          value={query.isActive === undefined ? 'all' : query.isActive ? 'true' : 'false'}
          onValueChange={(val) =>
            setQuery((q) => ({
              ...q,
              page: 1,
              isActive: val === 'all' ? undefined : val === 'true',
            }))
          }
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="كل الحالات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="true">نشط</SelectItem>
            <SelectItem value="false">غير نشط</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable<UserListItem>
        columns={columns}
        data={items}
        keyExtractor={(u) => u.id}
        loading={isLoading}
        emptyMessage="لا يوجد مستخدمون"
      />

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted-foreground">
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
