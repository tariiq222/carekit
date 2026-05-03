"use client"

import { Card, Skeleton } from "@deqah/ui"
import { formatBillingDate } from "@/lib/billing/utils"
import type { ProrationPreview } from "@/lib/types/billing"

function interpolate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, value),
    template,
  )
}

interface PlanChangeProrationBarProps {
  preview: ProrationPreview | undefined
  isLoading: boolean
  locale: "ar" | "en"
  t: (key: string) => string
}

export function PlanChangeProrationBar({
  preview,
  isLoading,
  locale,
  t,
}: PlanChangeProrationBarProps) {
  if (isLoading) {
    return <Skeleton className="h-16 w-full rounded-xl" />
  }

  if (!preview) return null

  let message: string
  if (preview.trialChange) {
    message = t("billing.plans.trialChange")
  } else if (preview.action === "SCHEDULE_DOWNGRADE" && preview.effectiveAt) {
    message = interpolate(t("billing.plans.scheduledFor"), {
      date: formatBillingDate(preview.effectiveAt, locale),
    })
  } else {
    message = interpolate(t("billing.plans.payNow"), {
      amount: preview.amountSar ?? "0.00",
    })
  }

  return (
    <Card className="flex items-center gap-3 px-5 py-4">
      <div className="space-y-0.5">
        <p className="text-xs font-medium text-muted-foreground">
          {t("billing.plan.proration.title")}
        </p>
        <p className="text-sm font-semibold text-foreground">{message}</p>
      </div>
    </Card>
  )
}
