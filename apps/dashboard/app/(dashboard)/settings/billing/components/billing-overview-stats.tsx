"use client"

import {
  CreditCardIcon,
  UserMultiple02Icon,
  Calendar03Icon,
  Invoice03Icon,
} from "@hugeicons/core-free-icons"
import { Skeleton } from "@deqah/ui"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { useLocale } from "@/components/locale-provider"
import { formatLocaleDate } from "@/lib/date"
import type { Subscription } from "@/lib/types/billing"

interface BillingOverviewStatsProps {
  subscription?: Subscription | null
  isLoading: boolean
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

function fmtDate(iso: string | null | undefined, locale: string): string {
  return formatLocaleDate(iso, locale, { year: "numeric", month: "short", day: "numeric" })
}

export function BillingOverviewStats({ subscription, isLoading }: BillingOverviewStatsProps) {
  const { t, locale } = useLocale()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[100px] w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (!subscription) return null

  const status = subscription.status
  const statusKey = `billing.status.${status.toLowerCase().replace("_", "")}` as const
  const planName = locale === "ar" ? subscription.plan.nameAr : subscription.plan.nameEn

  const employees = readUsageVal(subscription.usage, ["EMPLOYEES", "employees"])
  const empMax = subscription.plan.limits["maxEmployees"]
  const empDisplay =
    empMax === -1 || empMax === true
      ? `${employees} / ∞`
      : typeof empMax === "number" && empMax > 0
      ? `${employees} / ${empMax}`
      : String(employees)

  const nextDate = subscription.trialEndsAt ?? subscription.currentPeriodEnd
  const nextDateLabel = subscription.trialEndsAt
    ? t("billing.summary.trialEnds")
    : t("billing.summary.nextBilling")

  const invoiceCount = subscription.invoices?.length ?? 0

  return (
    <StatsGrid>
      <StatCard
        title={t("billing.overview.stat.plan")}
        value={`${planName} · ${t(statusKey)}`}
        icon={CreditCardIcon}
        iconColor="primary"
      />
      <StatCard
        title={t("billing.overview.stat.employees")}
        value={empDisplay}
        icon={UserMultiple02Icon}
        iconColor="success"
      />
      <StatCard
        title={nextDateLabel}
        value={fmtDate(nextDate, locale)}
        icon={Calendar03Icon}
        iconColor="warning"
      />
      <StatCard
        title={t("billing.overview.stat.invoices")}
        value={invoiceCount}
        icon={Invoice03Icon}
        iconColor="accent"
      />
    </StatsGrid>
  )
}
