"use client"

import Link from "next/link"
import { useBilling } from "@/lib/billing/billing-context"
import { useLocale } from "@/components/locale-provider"

export function TrialBanner() {
  const { status, subscription } = useBilling()
  const { t } = useLocale()

  if (!status || status === "ACTIVE" || status === "CANCELED") return null

  if (status === "TRIALING" && subscription?.trialEndsAt) {
    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / 86_400_000),
    )
    const message =
      daysLeft <= 1
        ? t("trialBanner.trialingLastDay")
        : t("trialBanner.trialing").replace("{days}", String(daysLeft))

    return (
      <div className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-sm text-warning">
        {message}
        {" · "}
        <Link href="/settings/billing" className="font-medium underline underline-offset-4">
          {t("trialBanner.subscribe")}
        </Link>
      </div>
    )
  }

  if (status === "PAST_DUE" || status === "SUSPENDED") {
    const message = status === "SUSPENDED" ? t("trialBanner.suspended") : t("trialBanner.pastDue")
    return (
      <div className="border-b border-error/30 bg-error/10 px-4 py-2 text-center text-sm text-error">
        {message}
        {" · "}
        <Link href="/settings/billing" className="font-medium underline underline-offset-4">
          {t("trialBanner.subscribe")}
        </Link>
      </div>
    )
  }

  return null
}
