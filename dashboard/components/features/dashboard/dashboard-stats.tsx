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
  const { locale } = useLocale()

  const todayBookings = stats?.total ?? 0
  const newPatients = stats?.confirmed ?? 0
  const pendingCount = stats?.pending ?? 0

  return (
    <StatsGrid>
      <StatCard
        index={0}
        title={locale === "ar" ? "حجوزات اليوم" : "Today's Bookings"}
        value={todayBookings}
        icon={Calendar03Icon}
        iconColor="primary"
        trend={{ value: "+12%", positive: true }}
      />
      <StatCard
        index={1}
        title={locale === "ar" ? "مرضى جدد" : "New Patients"}
        value={newPatients}
        icon={UserMultiple02Icon}
        iconColor="success"
        trend={{ value: "+8%", positive: true }}
      />
      <StatCard
        index={2}
        title={locale === "ar" ? "بانتظار الموافقة" : "Awaiting Approval"}
        value={pendingCount}
        icon={Clock01Icon}
        iconColor="warning"
        trend={{ value: "-3%", positive: false }}
      />
      <StatCard
        index={3}
        title={locale === "ar" ? "إيرادات اليوم" : "Today's Revenue"}
        value="—"
        icon={MoneyReceiveSquareIcon}
        iconColor="accent"
        trend={{ value: "+15%", positive: true }}
        description={locale === "ar" ? "ر.س" : "SAR"}
      />
    </StatsGrid>
  )
}
