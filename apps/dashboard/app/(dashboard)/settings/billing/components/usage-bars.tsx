"use client"

import { Card, Skeleton } from "@carekit/ui"
import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"
import type { Subscription } from "@/lib/types/billing"

interface UsageBarsProps {
  subscription?: Subscription | null
  isLoading: boolean
}

const metrics = [
  {
    labelKey: "billing.usage.bookings",
    usageKeys: ["BOOKINGS", "BOOKINGS_PER_MONTH", "bookings", "bookingsPerMonth"],
    limitKey: "maxBookingsPerMonth",
  },
  {
    labelKey: "billing.usage.branches",
    usageKeys: ["BRANCHES", "branches"],
    limitKey: "maxBranches",
  },
  {
    labelKey: "billing.usage.employees",
    usageKeys: ["EMPLOYEES", "employees"],
    limitKey: "maxEmployees",
  },
  {
    labelKey: "billing.usage.clients",
    usageKeys: ["CLIENTS", "clients"],
    limitKey: "maxClients",
  },
  {
    labelKey: "billing.usage.storage",
    usageKeys: ["STORAGE_MB", "storageMB", "storage"],
    limitKey: "maxStorageMB",
  },
] as const

function readUsage(
  usage: Partial<Record<string, number>> | undefined,
  keys: readonly string[],
) {
  for (const key of keys) {
    const value = usage?.[key]
    if (typeof value === "number") return value
  }

  return null
}

function UsageRow({
  label,
  used,
  max,
  unlimitedLabel,
  unavailableLabel,
}: {
  label: string
  used: number | null
  max: number | boolean | undefined
  unlimitedLabel: string
  unavailableLabel: string
}) {
  if (max === true || max === -1) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium text-foreground">{unlimitedLabel}</span>
        </div>
        <div className="h-2 rounded-full bg-primary/20" />
      </div>
    )
  }

  if (typeof max !== "number" || max <= 0 || used === null) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium text-muted-foreground">{unavailableLabel}</span>
        </div>
        <div className="h-2 rounded-full bg-muted" />
      </div>
    )
  }

  const progress = Math.min(Math.round((used / max) * 100), 100)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums text-foreground">
          {used} / {max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            progress >= 100 ? "bg-error" : progress >= 80 ? "bg-warning" : "bg-primary",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

export function UsageBars({ subscription, isLoading }: UsageBarsProps) {
  const { t } = useLocale()

  if (isLoading) {
    return (
      <Card className="space-y-5 p-6">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </Card>
    )
  }

  if (!subscription) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">{t("billing.empty.subscription")}</p>
      </Card>
    )
  }

  return (
    <Card className="space-y-5 p-6">
      <h3 className="text-base font-semibold text-foreground">
        {t("billing.usage.heading")}
      </h3>

      {metrics.map((metric) => (
        <UsageRow
          key={metric.limitKey}
          label={t(metric.labelKey)}
          used={readUsage(subscription.usage, metric.usageKeys)}
          max={subscription.plan.limits[metric.limitKey]}
          unlimitedLabel={t("billing.usage.unlimited")}
          unavailableLabel={t("billing.usage.unavailable")}
        />
      ))}
    </Card>
  )
}
