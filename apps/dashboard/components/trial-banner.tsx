"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useBilling } from "@/lib/billing/billing-context"
import { useLocale } from "@/components/locale-provider"

const toneClassNames = {
  calm: "border-primary/30 bg-primary/10 text-primary",
  warning: "border-warning/30 bg-warning/10 text-warning",
  blocking: "border-error/30 bg-error/10 text-error",
} as const

function withDays(template: string, days: number) {
  return template.replace("{days}", String(days))
}

export function TrialBanner() {
  const { status, subscription } = useBilling()
  const { t } = useLocale()
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    const updateNow = () => setNow(Date.now())
    updateNow()
    const intervalId = window.setInterval(updateNow, 60_000)
    return () => window.clearInterval(intervalId)
  }, [])

  if (!status || status === "ACTIVE" || status === "CANCELED") return null

  if (status === "TRIALING" && subscription?.trialEndsAt && now !== null) {
    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(subscription.trialEndsAt).getTime() - now) / 86_400_000),
    )
    const tone = daysLeft <= 1 ? "blocking" : daysLeft <= 3 ? "warning" : "calm"
    const message = daysLeft <= 1
      ? t("trialBanner.trialingLastDay")
      : withDays(
        t(daysLeft <= 3 ? "trialBanner.trialingWarning" : "trialBanner.trialing"),
        daysLeft,
      )

    return (
      <div className={`border-b px-4 py-2 text-center text-sm ${toneClassNames[tone]}`}>
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
      <div className={`border-b px-4 py-2 text-center text-sm ${toneClassNames.blocking}`}>
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
