"use client"

import Link from "next/link"
import { useLocale } from "@/components/locale-provider"
import { useBilling } from "@/lib/billing/billing-context"
import { cn } from "@/lib/utils"
import { getBillingUsageSummary, getLocalizedPlanName } from "@/lib/billing/utils"

export function BillingUsageWidget() {
  const { t, locale } = useLocale()
  const { subscription, isLoading } = useBilling()

  if (isLoading || !subscription) return null

  const usage = getBillingUsageSummary(subscription)
  if (usage.current === null || usage.max === null) return null

  const progress = Math.min(Math.round(usage.ratio * 100), 100)
  const isWarning = progress >= 80 && progress < 100
  const isExceeded = progress >= 100
  const planName = getLocalizedPlanName(subscription.plan, locale)

  return (
    <div className="hidden rounded-2xl border border-border/70 bg-background/60 p-3 backdrop-blur-sm md:block">
      <div className="space-y-2">
        <p className="text-[11px] font-medium text-muted-foreground">
          {t("billing.usage.title")}
        </p>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t("billing.plan.label")}</p>
          <p className="text-sm font-semibold text-foreground">{planName}</p>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">{t("billing.usage.bookings")}</span>
            <span className="font-medium tabular-nums text-foreground">
              {usage.current} / {usage.max}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isExceeded
                  ? "bg-error"
                  : isWarning
                    ? "bg-warning"
                    : "bg-primary",
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        {progress >= 80 && (
          <Link
            href="/settings/billing"
            className={cn(
              "inline-flex text-xs font-medium transition-colors hover:text-foreground",
              isExceeded ? "text-error" : "text-warning",
            )}
          >
            {t("billing.usage.upgradeCta")}
          </Link>
        )}
      </div>
    </div>
  )
}
