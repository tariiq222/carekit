"use client"

import { format } from "date-fns"
import { ar } from "date-fns/locale"

import { GreetingHeader } from "@/components/features/dashboard/greeting-header"
import { DashboardStats } from "@/components/features/dashboard/dashboard-stats"
import { AttentionAlerts } from "@/components/features/dashboard/attention-alerts"
import { QuickActions } from "@/components/features/dashboard/quick-actions"
import { TodayTimeline } from "@/components/features/dashboard/today-timeline"
import { ActivityFeed } from "@/components/features/dashboard/activity-feed"
import { RevenueChart } from "@/components/features/dashboard/revenue-chart"
import { RecentPayments } from "@/components/features/dashboard/recent-payments"
import { ErrorBanner } from "@/components/features/error-banner"
import { SectionHeader } from "@/components/features/section-header"
import { Skeleton } from "@carekit/ui"
import { FlashIcon, Analytics01Icon } from "@hugeicons/core-free-icons"
import { useTodayBookings } from "@/hooks/use-bookings"
import { useDashboardNotifications } from "@/hooks/use-notifications"
import { useDashboardStats } from "@/hooks/use-dashboard-stats"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/locale-provider"

export default function DashboardPage() {
  const today = format(new Date(), "yyyy-MM-dd")
  const { user } = useAuth()
  const { locale, t } = useLocale()

  const dateLabel = format(
    new Date(),
    locale === "ar" ? "EEEE، d MMMM yyyy" : "EEEE, MMMM d, yyyy",
    locale === "ar" ? { locale: ar } : undefined
  )

  const {
    data: todayBookings,
    isLoading: bookingsLoading,
    error: bookingsError,
    refetch: refetchBookings,
  } = useTodayBookings(today)

  const {
    data: notifData,
    isLoading: notifLoading,
    error: notifError,
    refetch: refetchNotifs,
  } = useDashboardNotifications()

  const {
    data: dashboardStats,
    isLoading: statsLoading,
    error: statsError,
  } = useDashboardStats()

  const userName = user?.name || user?.email || "—"

  return (
    <div className="flex flex-col gap-12">
      {/* Group 1: Overview — greeting + stats + alerts */}
      <section className="flex flex-col gap-6">
        <GreetingHeader
          userName={userName}
          dateLabel={dateLabel}
          bookingsCount={0}
        />

        <DashboardStats stats={dashboardStats} />
        <AttentionAlerts
          pendingPayments={dashboardStats?.pendingPayments ?? 0}
          cancelRequests={dashboardStats?.cancelRequests ?? 0}
        />
      </section>

      {/* Group 2: Quick Actions */}
      <section className="flex flex-col gap-4">
        <SectionHeader icon={FlashIcon} title={t("dashboard.quickActions")} />
        <QuickActions />
      </section>

      {/* Group 3: Operational — schedule + activity + charts */}
      <section className="flex flex-col gap-5">
        <SectionHeader
          icon={Analytics01Icon}
          title={t("dashboard.operations")}
          variant="accent"
        />

        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          {bookingsLoading ? (
            <Skeleton className="h-[400px] rounded-xl" />
          ) : bookingsError ? (
            <ErrorBanner
              message={t("dashboard.error.schedule")}
              onRetry={() => refetchBookings()}
            />
          ) : (
            <TodayTimeline bookings={todayBookings?.items ?? []} />
          )}

          {notifLoading ? (
            <Skeleton className="h-[400px] rounded-xl" />
          ) : notifError ? (
            <ErrorBanner
              message={t("dashboard.error.activity")}
              onRetry={() => refetchNotifs()}
            />
          ) : (
            <ActivityFeed notifications={notifData?.items ?? []} />
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <RevenueChart />
          <RecentPayments />
        </div>
      </section>
    </div>
  )
}
