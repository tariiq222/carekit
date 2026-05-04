"use client"

import { Card, Skeleton } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"
import { useUsage } from "@/hooks/use-usage"

const FEATURE_LABEL_KEY: Record<string, string> = {
  MAX_BRANCHES: "billing.usage.branches",
  MAX_EMPLOYEES: "billing.usage.employees",
  MAX_SERVICES: "billing.usage.clients",
  MAX_BOOKINGS_PER_MONTH: "billing.usage.bookings",
  branches: "billing.usage.branches",
  employees: "billing.usage.employees",
  services: "billing.usage.clients",
  monthly_bookings: "billing.usage.bookings",
}

function UsageRow({
  label,
  current,
  limit,
  percentage,
  unlimitedLabel,
}: {
  label: string
  current: number
  limit: number
  percentage: number
  unlimitedLabel: string
}) {
  const isUnlimited = limit < 0
  const pct = isUnlimited ? 0 : Math.min(percentage, 100)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums text-foreground">
          {isUnlimited ? `${current} / ${unlimitedLabel}` : `${current} / ${limit}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              pct >= 100 ? "bg-error" : pct >= 80 ? "bg-warning" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

export function UsageBars() {
  const { t } = useLocale()
  const { data: rows, isLoading } = useUsage()

  if (isLoading) {
    return (
      <Card className="space-y-5 p-6">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
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

  if (!rows || rows.length === 0) return null

  return (
    <Card className="space-y-5 p-6">
      <h3 className="text-base font-semibold text-foreground">
        {t("billing.usage.heading")}
      </h3>
      {rows.map((row) => (
        <UsageRow
          key={row.featureKey}
          label={t(FEATURE_LABEL_KEY[row.featureKey] ?? row.featureKey)}
          current={row.current}
          limit={row.limit}
          percentage={row.percentage}
          unlimitedLabel={t("billing.usage.unlimited")}
        />
      ))}
    </Card>
  )
}
