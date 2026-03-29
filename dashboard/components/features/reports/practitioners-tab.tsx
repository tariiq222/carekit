"use client"

import { ErrorBanner } from "@/components/features/error-banner"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchPractitionerReport } from "@/lib/api/reports"
import { useLocale } from "@/components/locale-provider"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Calendar03Icon,
  CheckmarkCircle02Icon,
  MoneyBag02Icon,
  StarIcon,
} from "@hugeicons/core-free-icons"

interface PractitionersTabProps {
  dateFrom: string
  dateTo: string
  practitionerId: string
}

export function PractitionersTab({ dateFrom, dateTo, practitionerId }: PractitionersTabProps) {
  const { t, locale } = useLocale()

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.reports.practitioner(practitionerId, { dateFrom, dateTo }),
    queryFn: () => fetchPractitionerReport(practitionerId, { dateFrom, dateTo }),
    enabled: !!practitionerId && !!dateFrom && !!dateTo,
  })

  if (!practitionerId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">
          {t("reports.practitionerSearchHint") ?? "ابحث عن طبيب بالاسم أو ID لعرض تقريره"}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error.message} />}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : data ? (
        <StatsGrid>
          <StatCard
            title={t("reports.revenue.bookings")}
            value={data.totalBookings}
            icon={Calendar03Icon}
            iconColor="primary"
          />
          <StatCard
            title={t("bookings.stats.completed")}
            value={data.completedBookings}
            icon={CheckmarkCircle02Icon}
            iconColor="success"
          />
          <StatCard
            title={t("reports.revenue.total")}
            value={<FormattedCurrency amount={data.totalRevenue} locale={locale} />}
            icon={MoneyBag02Icon}
            iconColor="success"
          />
          <StatCard
            title={t("practitioners.stats.avgRating")}
            value={data.averageRating.toFixed(1)}
            icon={StarIcon}
            iconColor="warning"
          />
        </StatsGrid>
      ) : null}
    </div>
  )
}
