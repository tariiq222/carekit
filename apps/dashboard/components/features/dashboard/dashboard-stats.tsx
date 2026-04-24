"use client"

import {
  Calendar03Icon,
  UserMultiple02Icon,
  Clock01Icon,
  MoneyReceiveSquareIcon,
} from "@hugeicons/core-free-icons"

import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { useLocale } from "@/components/locale-provider"

interface DashboardStatsApi {
  todayBookings: number
  confirmedToday: number
  pendingToday: number
  pendingPayments: number
  cancelRequests: number
  todayRevenue: number
}

interface DashboardStatsProps {
  stats: DashboardStatsApi | undefined
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  const { t } = useLocale()

  const todayBookings = stats?.todayBookings ?? 0
  const confirmedToday = stats?.confirmedToday ?? 0
  const pendingToday = stats?.pendingToday ?? 0
  const todayRevenue = stats?.todayRevenue ?? 0

  return (
    <StatsGrid>
      <StatCard
        title={t("dashboard.todayBookings")}
        value={todayBookings}
        icon={Calendar03Icon}
        iconColor="primary"
      />
      <StatCard
        title={t("dashboard.newClients")}
        value={confirmedToday}
        icon={UserMultiple02Icon}
        iconColor="success"
      />
      <StatCard
        title={t("dashboard.awaitingApproval")}
        value={pendingToday}
        icon={Clock01Icon}
        iconColor="warning"
      />
      <StatCard
        title={t("dashboard.todayRevenue")}
        value={todayRevenue}
        icon={MoneyReceiveSquareIcon}
        iconColor="accent"
        description={t("dashboard.currency")}
      />
    </StatsGrid>
  )
}
