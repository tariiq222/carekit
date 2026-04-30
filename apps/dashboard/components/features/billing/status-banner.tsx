"use client"

import { Button, Card } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { useBillingMutations } from "@/hooks/use-current-subscription"
import { useBilling } from "@/lib/billing/billing-context"
import { formatBillingDate, getEmployeeUsageSummary } from "@/lib/billing/utils"
import { cn } from "@/lib/utils"

const BANNER_VARIANTS = {
  SUSPENDED: {
    titleKey: "billing.banner.suspended.title",
    descriptionKey: "billing.banner.suspended.description",
    className: "border-error/30 bg-error/10 text-error",
  },
  CANCELED: {
    titleKey: "billing.banner.canceled.title",
    descriptionKey: "billing.banner.canceled.description",
    className: "border-border bg-muted text-foreground",
  },
} as const

type BannerStatus = keyof typeof BANNER_VARIANTS

export function BillingStatusBanner() {
  const { t, locale } = useLocale()
  const { status, subscription } = useBilling()
  const { retryPaymentMut } = useBillingMutations()

  if (status === "PAST_DUE") {
    const nextRetryAt = subscription?.nextRetryAt
      ? formatBillingDate(subscription.nextRetryAt, locale)
      : null

    return (
      <Card className="border border-warning/30 bg-warning/10 p-4 text-warning">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="font-semibold">{t("billing.banner.dunning.title")}</p>
            <p className="text-sm opacity-90">{t("billing.banner.dunning.description")}</p>
            {nextRetryAt && (
              <p className="text-xs opacity-80">
                {t("billing.banner.dunning.nextRetry")}: {nextRetryAt}
              </p>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full border-warning/40 bg-background text-warning hover:bg-warning/10 hover:text-warning md:w-auto"
            disabled={retryPaymentMut.isPending}
            onClick={() => retryPaymentMut.mutate()}
          >
            {retryPaymentMut.isPending
              ? t("billing.banner.dunning.retrying")
              : t("billing.banner.dunning.retry")}
          </Button>
        </div>
      </Card>
    )
  }

  if (status === "SUSPENDED" || status === "CANCELED") {
    const variant = BANNER_VARIANTS[status as BannerStatus]

    return (
      <Card className={cn("space-y-1 border p-4", variant.className)}>
        <p className="font-semibold">{t(variant.titleKey)}</p>
        <p className="text-sm opacity-90">{t(variant.descriptionKey)}</p>
      </Card>
    )
  }

  if (subscription?.cancelAtPeriodEnd && status === "ACTIVE") {
    return (
      <Card className="space-y-1 border border-warning/30 bg-warning/10 p-4 text-warning">
        <p className="font-semibold">{t("billing.banner.scheduledCancel.title")}</p>
        <p className="text-sm opacity-90">{t("billing.banner.scheduledCancel.description")}</p>
      </Card>
    )
  }

  const employeeUsage = getEmployeeUsageSummary(subscription)
  if (status === "ACTIVE" && employeeUsage.ratio >= 0.8 && employeeUsage.ratio < 1) {
    return (
      <Card className="space-y-1 border border-warning/30 bg-warning/10 p-4 text-warning">
        <p className="font-semibold">{t("billing.banner.limitWarning.title")}</p>
        <p className="text-sm opacity-90">{t("billing.banner.limitWarning.description")}</p>
      </Card>
    )
  }

  return null
}
