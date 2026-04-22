"use client"

import { Card } from "@carekit/ui"
import { useLocale } from "@/components/locale-provider"
import { useBilling } from "@/lib/billing/billing-context"
import { cn } from "@/lib/utils"

const BANNER_VARIANTS = {
  PAST_DUE: {
    titleKey: "billing.banner.pastDue.title",
    descriptionKey: "billing.banner.pastDue.description",
    className: "border-warning/30 bg-warning/10 text-warning",
  },
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
  const { t } = useLocale()
  const { status } = useBilling()

  if (status !== "PAST_DUE" && status !== "SUSPENDED" && status !== "CANCELED") {
    return null
  }

  const variant = BANNER_VARIANTS[status as BannerStatus]

  return (
    <Card className={cn("space-y-1 border p-4", variant.className)}>
      <p className="font-semibold">{t(variant.titleKey)}</p>
      <p className="text-sm opacity-90">{t(variant.descriptionKey)}</p>
    </Card>
  )
}
