import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { reportsApi } from '@carekit/api-client'
import type { ReportDateParams, BookingReport } from '@carekit/api-client'
import { useRevenueReport, useBookingReport } from '@/hooks/use-reports'
import { PageHeader } from '@/components/shared/page-header'
import { StatsGrid } from '@/components/shared/stats-grid'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { HIcon } from '@/components/shared/hicon'

export const Route = createFileRoute('/_dashboard/reports/')({
  component: ReportsPage,
})

function RevenueBarChart({ data }: { data: Array<{ month: string; revenue: number }> }) {
  const max = Math.max(...data.map((d) => d.revenue), 1)
  return (
    <div className="glass rounded-[var(--radius)] p-5">
      <h2 className="text-base font-bold text-[var(--fg)] mb-4">الإيراد الشهري</h2>
      <div className="flex items-end gap-1.5 h-32">
        {data.map((d) => (
          <div key={d.month} className="flex flex-col items-center flex-1 gap-1 min-w-0">
            <div
              className="w-full bg-[var(--primary)] rounded-t-[var(--radius-sm)] min-h-[3px] transition-all"
              style={{ height: `${(d.revenue / max) * 100}%` }}
            />
            <span className="text-[10px] text-[var(--muted)] truncate w-full text-center">
              {d.month}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BookingStatusBreakdown({ data }: { data: BookingReport }) {
  const statusItems = [
    { label: 'مؤكدة', value: data.byStatus.confirmed, color: 'bg-[var(--success)]' },
    { label: 'معلقة', value: data.byStatus.pending, color: 'bg-[var(--warning)]' },
    { label: 'مكتملة', value: data.byStatus.completed, color: 'bg-[var(--primary)]' },
    { label: 'ملغاة', value: data.byStatus.cancelled, color: 'bg-[var(--muted)]' },
  ]
  return (
    <div className="glass rounded-[var(--radius)] p-5">
      <h2 className="text-base font-bold text-[var(--fg)] mb-4">توزيع الحجوزات</h2>
      <div className="space-y-3">
        {statusItems.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span className="text-sm text-[var(--fg-2)] w-16 shrink-0">{item.label}</span>
            <div className="flex-1 h-2 rounded-full bg-[var(--surface)]">
              <div
                className={`h-2 rounded-full ${item.color}`}
                style={{
                  width: `${data.total > 0 ? (item.value / data.total) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-sm font-semibold text-[var(--fg)] w-8 text-end">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReportsPage() {
  const [params, setParams] = useState<ReportDateParams>({})
  const [exportError, setExportError] = useState<string | null>(null)

  const revenueQuery = useRevenueReport(params)
  const bookingQuery = useBookingReport(params)

  if (revenueQuery.isLoading && bookingQuery.isLoading) {
    return <SkeletonPage />
  }

  const revenue = revenueQuery.data
  const booking = bookingQuery.data

  const statCards = [
    {
      label: 'إيراد الفترة (ر.س)',
      value: revenue?.totalRevenue != null ? revenue.totalRevenue.toLocaleString('ar-SA') : '—',
      icon: 'hgi-money-bag-02',
      variant: 'primary' as const,
    },
    {
      label: 'إجمالي الحجوزات',
      value: booking?.total ?? 0,
      icon: 'hgi-calendar-03',
      variant: 'success' as const,
    },
    {
      label: 'متوسط الحجز (ر.س)',
      value:
        revenue?.averagePerBooking != null ? revenue.averagePerBooking.toFixed(0) : '—',
      icon: 'hgi-coins-01',
      variant: 'warning' as const,
    },
    {
      label: 'حجوزات مدفوعة',
      value: revenue?.paidBookings ?? 0,
      icon: 'hgi-credit-card',
      variant: 'accent' as const,
    },
  ]

  async function handleExport(type: 'revenue' | 'bookings' | 'patients') {
    setExportError(null)
    try {
      const blob = type === 'revenue'
        ? await reportsApi.exportRevenue(params)
        : type === 'bookings'
          ? await reportsApi.exportBookings(params)
          : await reportsApi.exportPatients()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}-report.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setExportError('حدث خطأ أثناء التصدير. حاول مرة أخرى.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="التقارير والإحصائيات"
        description="نظرة شاملة على أداء العيادة"
      />

      <div className="glass rounded-[var(--radius)] p-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--muted)]">من</label>
          <input
            type="date"
            value={params.dateFrom ?? ''}
            onChange={(e) =>
              setParams((p) => ({ ...p, dateFrom: e.target.value || undefined }))
            }
            className="h-9 px-3 rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-solid)] text-sm text-[var(--fg)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--muted)]">إلى</label>
          <input
            type="date"
            value={params.dateTo ?? ''}
            onChange={(e) =>
              setParams((p) => ({ ...p, dateTo: e.target.value || undefined }))
            }
            className="h-9 px-3 rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-solid)] text-sm text-[var(--fg)]"
          />
        </div>
        <button
          onClick={() => setParams({})}
          className="h-9 px-3 rounded-[var(--radius-sm)] border border-[var(--border-soft)] text-sm text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
        >
          إعادة تعيين
        </button>
      </div>

      <StatsGrid
        stats={statCards}
        loading={revenueQuery.isLoading || bookingQuery.isLoading}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {revenueQuery.data?.byMonth && revenueQuery.data.byMonth.length > 0 && (
          <RevenueBarChart data={revenueQuery.data.byMonth} />
        )}
        {bookingQuery.data && (
          <BookingStatusBreakdown data={bookingQuery.data} />
        )}
      </div>

      <div className="glass rounded-[var(--radius)] p-5">
        <h2 className="text-base font-bold text-[var(--fg)] mb-4">تصدير البيانات</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => handleExport('revenue')}>
            <HIcon name="hgi-download-02" className="me-2" />
            تصدير الإيرادات (CSV)
          </Button>
          <Button variant="outline" onClick={() => handleExport('bookings')}>
            <HIcon name="hgi-download-02" className="me-2" />
            تصدير الحجوزات (CSV)
          </Button>
          <Button variant="outline" onClick={() => handleExport('patients')}>
            <HIcon name="hgi-download-02" className="me-2" />
            تصدير المرضى (CSV)
          </Button>
        </div>
        {exportError && (
          <p className="text-sm text-[var(--danger)] mt-2">{exportError}</p>
        )}
      </div>
    </div>
  )
}
