"use client"

import {
  UserMultiple02Icon,
  Store01Icon,
  UserGroupIcon,
  Calendar01Icon,
} from "@hugeicons/core-free-icons"
import { Skeleton } from "@deqah/ui"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { useLocale } from "@/components/locale-provider"
import type { Subscription } from "@/lib/types/billing"

interface UsageStatsGridProps {
  subscription?: Subscription | null
  isLoading: boolean
}

function fmtLimit(value: number | boolean | undefined, t: (k: string) => string): string {
  if (value === -1 || value === true) return t("billing.usage.stat.unlimited")
  if (typeof value !== "number" || value <= 0) return t("billing.usage.stat.na")
  return String(value)
}

function readUsageVal(
  usage: Partial<Record<string, number>> | undefined,
  keys: string[],
): number {
  for (const key of keys) {
    const v = usage?.[key]
    if (typeof v === "number") return v
  }
  return 0
}

export function UsageStatsGrid({ subscription, isLoading }: UsageStatsGridProps) {
  const { t } = useLocale()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[100px] w-full rounded-xl" />
        ))}
      </div>
    )
  }

  const limits = subscription?.plan.limits ?? {}
  const usage = subscription?.usage

  const employees = readUsageVal(usage, ["EMPLOYEES", "employees"])
  const branches = readUsageVal(usage, ["BRANCHES", "branches"])
  const clients = readUsageVal(usage, ["CLIENTS", "clients"])
  const bookings = readUsageVal(usage, ["MONTHLY_BOOKINGS", "monthly_bookings", "BOOKINGS_PER_MONTH"])

  const empMax = fmtLimit(limits["maxEmployees"], t)
  const branchMax = fmtLimit(limits["maxBranches"], t)
  const clientMax = fmtLimit(limits["maxClients"], t)
  const bookingsMax = fmtLimit(limits["maxBookingsPerMonth"], t)

  return (
    <StatsGrid>
      <StatCard
        title={t("billing.usage.stat.employees")}
        value={`${employees} / ${empMax}`}
        icon={UserMultiple02Icon}
        iconColor="primary"
      />
      <StatCard
        title={t("billing.usage.stat.branches")}
        value={`${branches} / ${branchMax}`}
        icon={Store01Icon}
        iconColor="success"
      />
      <StatCard
        title={t("billing.usage.stat.clients")}
        value={`${clients} / ${clientMax}`}
        icon={UserGroupIcon}
        iconColor="warning"
      />
      <StatCard
        title={t("billing.usage.stat.bookings")}
        value={`${bookings} / ${bookingsMax}`}
        icon={Calendar01Icon}
        iconColor="accent"
      />
    </StatsGrid>
  )
}
