"use client"

import Link from "next/link"
import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"
import { useUsage } from "@/hooks/use-usage"
import type { UsageRow } from "@/lib/types/billing"

/**
 * Maps backend featureKey strings to i18n translation keys.
 */
const FEATURE_LABEL_KEY: Record<string, string> = {
  MAX_BRANCHES: "billing.usage.branches",
  MAX_EMPLOYEES: "billing.usage.employees",
  MAX_SERVICES: "billing.usage.clients", // services ~ clients label
  MAX_BOOKINGS_PER_MONTH: "billing.usage.bookings",
  // canonical lowercase variants used by backend FeatureKey enum
  branches: "billing.usage.branches",
  employees: "billing.usage.employees",
  services: "billing.usage.clients",
  monthly_bookings: "billing.usage.bookings",
}

function UsageBar({ row, t }: { row: UsageRow; t: (k: string) => string }) {
  const isUnlimited = row.limit < 0
  const pct = isUnlimited ? 0 : Math.min(row.percentage, 100)
  const isWarning = !isUnlimited && pct >= 80 && pct < 100
  const isBlocked = !isUnlimited && pct >= 100

  const label = FEATURE_LABEL_KEY[row.featureKey] ?? row.featureKey
  const limitDisplay = isUnlimited ? t("billing.usage.unlimited") : String(row.limit)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{t(label)}</span>
        <span className="font-medium tabular-nums text-foreground">
          {row.current} / {limitDisplay}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isBlocked
                ? "bg-destructive"
                : isWarning
                  ? "bg-warning"
                  : "bg-success",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {isWarning && (
        <p className="text-[10px] text-muted-foreground">{t("billing.usage.warning")}</p>
      )}
    </div>
  )
}

export function BillingUsageWidget() {
  const { t } = useLocale()
  const { data: rows, isLoading } = useUsage()

  if (isLoading || !rows || rows.length === 0) return null

  const hasBlocked = rows.some((r) => r.limit >= 0 && r.percentage >= 100)

  return (
    <div className="hidden rounded-2xl border border-border/70 bg-background/60 p-3 backdrop-blur-sm md:block">
      <div className="space-y-2">
        <p className="text-[11px] font-medium text-muted-foreground">
          {t("billing.usage.title")}
        </p>

        <div className="space-y-2">
          {rows.map((row) => (
            <UsageBar key={row.featureKey} row={row} t={t} />
          ))}
        </div>

        {hasBlocked && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">
            {t("billing.usage.blocked")}
          </div>
        )}

        {(hasBlocked || rows.some((r) => r.limit >= 0 && r.percentage >= 80)) && (
          <Link
            href="/subscription"
            className={cn(
              "inline-flex text-xs font-medium transition-colors hover:text-foreground",
              hasBlocked ? "text-destructive" : "text-warning",
            )}
          >
            {t("billing.usage.upgradeCta")}
          </Link>
        )}
      </div>
    </div>
  )
}
