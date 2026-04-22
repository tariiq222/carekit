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

interface BookingStats {
  total?: number
  pending?: number
  confirmed?: number
  completed?: number
  cancelled?: number
  pendingCancellation?: number
}

interface DashboardStatsProps {
  stats: BookingStats | undefined
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  const { t } = useLocale()

  const todayBookings = stats?.total ?? 0
  const newClients = stats?.confirmed ?? 0
  const pendingCount = stats?.pending ?? 0

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
        value={newClients}
        icon={UserMultiple02Icon}
        iconColor="success"
      />
      <StatCard
        title={t("dashboard.awaitingApproval")}
        value={pendingCount}
        icon={Clock01Icon}
        iconColor="warning"
      />
      <StatCard
        title={t("dashboard.todayRevenue")}
        value="—"
        icon={MoneyReceiveSquareIcon}
        iconColor="accent"
        description={t("dashboard.currency")}
      />
    </StatsGrid>
  )
}
