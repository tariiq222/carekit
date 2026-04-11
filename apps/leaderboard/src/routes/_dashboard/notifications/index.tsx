import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import type { NotificationListItem, NotificationListQuery } from '@carekit/api-client'

type NotificationQuery = NotificationListQuery & { search?: string }

import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/use-notifications'
import { PageHeader } from '@/components/shared/page-header'
import { StatsGrid } from '@/components/shared/stats-grid'
import { FilterBar } from '@/components/shared/filter-bar'
import { DataTable } from '@/components/shared/data-table'
import { Button } from '@/components/ui/button'
import { HIcon } from '@/components/shared/hicon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export const Route = createFileRoute('/_dashboard/notifications/')({
  component: NotificationsPage,
})

const TYPE_LABELS: Record<string, string> = {
  booking_confirmed: 'تأكيد حجز',
  booking_cancelled: 'إلغاء حجز',
  payment_received: 'دفعة مستلمة',
  system: 'نظام',
}

function NotificationsPage() {
  const [query, setQuery] = useState<NotificationQuery>({ page: 1, perPage: 20 })

  const { search: _search, ...apiQuery } = query
  const listQuery = useNotifications(apiQuery)
  const unreadQuery = useUnreadCount()
  const markReadMutation = useMarkNotificationRead()
  const markAllMutation = useMarkAllNotificationsRead()

  const data = listQuery.data
  const items = data?.items ?? []
  const meta = data?.meta
  const total = meta?.total ?? 0
  const unread = unreadQuery.data?.count ?? 0
  const read = total - unread

  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const thisWeek = items.filter((n) => new Date(n.createdAt).getTime() >= oneWeekAgo).length

  const statCards = [
    { label: 'الإجمالي', value: total, icon: 'hgi-notification-03', variant: 'primary' as const },
    { label: 'غير مقروءة', value: unread, icon: 'hgi-mail-01', variant: 'warning' as const },
    { label: 'مقروءة', value: read, icon: 'hgi-tick-02', variant: 'success' as const },
    { label: 'هذا الأسبوع', value: thisWeek, icon: 'hgi-calendar-03', variant: 'accent' as const },
  ]

  const columns = [
    {
      key: 'title',
      header: 'العنوان',
      render: (n: NotificationListItem) => (
        <span className={`text-[var(--fg)] ${n.isRead ? '' : 'font-semibold'}`}>{n.title}</span>
      ),
    },
    {
      key: 'body',
      header: 'المحتوى',
      render: (n: NotificationListItem) => (
        <span className="text-[var(--muted)] text-xs">
          {n.body.length > 50 ? `${n.body.slice(0, 50)}…` : n.body}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'النوع',
      render: (n: NotificationListItem) => (
        <span className="inline-flex rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium bg-[var(--surface)] text-[var(--muted)] border border-[var(--border-soft)]">
          {TYPE_LABELS[n.type] ?? n.type}
        </span>
      ),
    },
    {
      key: 'isRead',
      header: 'الحالة',
      render: (n: NotificationListItem) =>
        n.isRead ? (
          <span className="inline-flex rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium bg-[var(--success-bg)] text-[var(--success)] border border-[color:var(--success)]/30">
            مقروءة
          </span>
        ) : (
          <span className="inline-flex rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium bg-[var(--warning-bg)] text-[var(--warning)] border border-[color:var(--warning)]/30">
            غير مقروءة
          </span>
        ),
    },
    {
      key: 'createdAt',
      header: 'التاريخ',
      render: (n: NotificationListItem) =>
        new Date(n.createdAt).toLocaleDateString('ar-SA', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
    },
    {
      key: 'actions',
      header: '',
      render: (n: NotificationListItem) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => markReadMutation.mutate(n.id)}
              disabled={n.isRead || markReadMutation.isPending}
              className="inline-flex items-center justify-center size-9 rounded-[var(--radius-sm)] hover:bg-[var(--surface)] text-[var(--fg-2)] transition-colors disabled:opacity-40"
            >
              <HIcon name="hgi-tick-02" />
            </button>
          </TooltipTrigger>
          <TooltipContent>تعليم كمقروء</TooltipContent>
        </Tooltip>
      ),
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
        title="الإشعارات"
        description="إدارة ومتابعة إشعارات النظام"
        actions={
          <Button
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
          >
            <HIcon name="hgi-tick-double-01" className="me-2" />
            تعليم الكل كمقروء
          </Button>
        }
      />

      <StatsGrid stats={statCards} loading={listQuery.isLoading || unreadQuery.isLoading} />

      <FilterBar
        search={query.search ?? ''}
        onSearchChange={handleSearch}
        onReset={handleReset}
        placeholder="ابحث في الإشعارات..."
      />

      <DataTable
        columns={columns}
        data={items}
        keyExtractor={(n) => n.id}
        loading={listQuery.isFetching}
        emptyMessage="لا توجد إشعارات"
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
