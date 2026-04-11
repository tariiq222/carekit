import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import type {
  BookingListItem,
  BookingListQuery,
  BookingStatus,
  BookingType,
} from '@carekit/api-client'
import { PageHeader } from '@/components/shared/page-header'
import { StatsGrid } from '@/components/shared/stats-grid'
import { FilterBar } from '@/components/shared/filter-bar'
import { DataTable } from '@/components/shared/data-table'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HIcon } from '@/components/shared/hicon'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useBookings, useBookingStats } from '@/hooks/use-bookings'
import { BookingStatusBadge } from '@/components/features/bookings/booking-status-badge'

export const Route = createFileRoute('/_dashboard/bookings/')({
  component: BookingsListPage,
})

const TYPE_LABELS: Record<BookingType, string> = {
  in_person: 'حضوري',
  online: 'أونلاين',
  walk_in: 'بدون موعد',
}

const STATUS_FILTER_OPTIONS: Array<{ value: 'all' | BookingStatus; label: string }> = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'pending', label: 'معلق' },
  { value: 'confirmed', label: 'مؤكد' },
  { value: 'completed', label: 'مكتمل' },
  { value: 'cancelled', label: 'ملغى' },
  { value: 'no_show', label: 'لم يحضر' },
]

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

function BookingsListPage() {
  const [query, setQuery] = useState<BookingListQuery>({ page: 1, perPage: 20 })
  const [search, setSearch] = useState('')

  const { data: stats, isLoading: statsLoading } = useBookingStats()
  const { data, isLoading } = useBookings(query)

  if (isLoading && !data) return <SkeletonPage />

  const statCards = [
    {
      label: 'إجمالي الحجوزات',
      value: stats?.total ?? 0,
      icon: 'hgi-calendar-03',
      variant: 'primary' as const,
    },
    {
      label: 'حجوزات اليوم',
      value: stats?.today ?? 0,
      icon: 'hgi-clock-01',
      variant: 'primary' as const,
    },
    {
      label: 'معلقة',
      value: stats?.pending ?? 0,
      icon: 'hgi-hourglass',
      variant: 'warning' as const,
    },
    {
      label: 'مكتملة',
      value: stats?.completed ?? 0,
      icon: 'hgi-tick-double-01',
      variant: 'success' as const,
    },
  ]

  const columns = [
    {
      key: 'patient',
      header: 'المريض',
      render: (b: BookingListItem) =>
        b.patient ? `${b.patient.firstName} ${b.patient.lastName}` : 'زائر',
    },
    {
      key: 'practitioner',
      header: 'الممارس',
      render: (b: BookingListItem) =>
        `${b.practitioner.user.firstName} ${b.practitioner.user.lastName}`,
    },
    {
      key: 'service',
      header: 'الخدمة',
      render: (b: BookingListItem) => b.service.nameAr,
    },
    {
      key: 'date',
      header: 'التاريخ',
      render: (b: BookingListItem) => formatDate(b.date),
    },
    {
      key: 'time',
      header: 'الوقت',
      render: (b: BookingListItem) => b.startTime,
    },
    {
      key: 'type',
      header: 'النوع',
      render: (b: BookingListItem) => TYPE_LABELS[b.type],
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (b: BookingListItem) => <BookingStatusBadge status={b.status} />,
    },
    {
      key: 'price',
      header: 'السعر',
      render: (b: BookingListItem) =>
        b.bookedPrice != null ? `${b.bookedPrice} ر.س` : '—',
    },
    {
      key: 'actions',
      header: '',
      render: (b: BookingListItem) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/bookings/$id"
              params={{ id: b.id }}
              className="inline-flex items-center justify-center size-9 rounded-sm text-muted-foreground hover:bg-surface-muted hover:text-foreground transition-colors"
            >
              <HIcon name="hgi-eye" />
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
        title="الحجوزات"
        description="إدارة جميع حجوزات العيادة"
        actions={
          <Link to="/bookings/new">
            <Button>
              <HIcon name="hgi-add-01" className="me-1" />
              حجز جديد
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
        placeholder="بحث في الحجوزات..."
      >
        <Select
          value={query.status ?? 'all'}
          onValueChange={(val) =>
            setQuery((q) => ({
              ...q,
              page: 1,
              status: (val === 'all' ? undefined : val) as BookingStatus | undefined,
            }))
          }
        >
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="كل الحالات" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable<BookingListItem>
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(b) => b.id}
        loading={isLoading}
        emptyMessage="لا توجد حجوزات"
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
