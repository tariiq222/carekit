"use client"

import { useLocale } from "@/components/locale-provider"
import { StatCard } from "@/components/features/stat-card"
import type { IconSvgElement } from "@hugeicons/react"

interface OverviewItem {
  titleKey: string
  value: string | number
  icon: IconSvgElement
  color: "primary" | "success" | "warning" | "info"
  subtitle: string
  trend?: { value: number; positive: boolean }
}

interface TodayOverviewProps {
  items: OverviewItem[]
}

const colorMap: Record<OverviewItem["color"], "primary" | "accent" | "warning" | "success"> = {
  primary: "primary",
  success: "success",
  warning: "warning",
  info: "accent",
}

export function TodayOverview({ items }: TodayOverviewProps) {
  const { t } = useLocale()

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <StatCard
          key={item.titleKey}
          title={t(item.titleKey)}
          value={item.value}
          icon={item.icon}
          iconColor={colorMap[item.color]}
          description={t(item.subtitle)}
          trend={item.trend ? { value: `${item.trend.value}%`, positive: item.trend.positive } : undefined}
        />
      ))}
    </div>
  )
}
