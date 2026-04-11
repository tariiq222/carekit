"use client"

import { useLocale } from "@/components/locale-provider"

interface GreetingHeaderProps {
  userName: string
}

export function GreetingHeader({ userName }: GreetingHeaderProps) {
  const { t } = useLocale()

  const hour = new Date().getHours()
  const greetingKey =
    hour < 12
      ? "dashboard.goodMorning"
      : hour < 17
        ? "dashboard.goodAfternoon"
        : "dashboard.goodEvening"

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold tracking-tight">
        {t(greetingKey)}, {userName}
      </h1>
      <p className="text-muted-foreground text-sm">
        {t("dashboard.todayOverview")}
      </p>
    </div>
  )
}
