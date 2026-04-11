"use client"

import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Calendar03Icon,
  Clock01Icon,
  Tick02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import { Card } from "@/components/ui/card"
import { useLocale } from "@/components/locale-provider"
import type { BookingStats } from "@/lib/types/booking"

interface BookingOverviewProps {
  stats: BookingStats
  className?: string
}

const items = [
  {
    key: "total",
    titleKey: "bookings.stats.total",
    icon: Calendar03Icon,
    color: "primary",
    statField: "total" as const,
    trend: 12,
    trendUp: true,
  },
  {
    key: "confirmed",
    titleKey: "bookings.stats.confirmed",
    icon: Tick02Icon,
    color: "success",
    statField: "confirmed" as const,
    trend: 6,
    trendUp: true,
  },
  {
    key: "pending",
    titleKey: "bookings.stats.pending",
    icon: Clock01Icon,
    color: "warning",
    statField: "pending" as const,
    trend: 2,
    trendUp: true,
  },
  {
    key: "cancelRequests",
    titleKey: "bookings.stats.cancelRequests",
    icon: Cancel01Icon,
    color: "error",
    statField: "pendingCancellation" as const,
    trend: 5,
    trendUp: false,
  },
] as const

const colorMap = {
  primary: {
    iconBg: "bg-primary/8",
    iconText: "text-primary",
    decorative: "bg-primary",
  },
  success: {
    iconBg: "bg-success/10",
    iconText: "text-success",
    decorative: "bg-success",
  },
  warning: {
    iconBg: "bg-warning/10",
    iconText: "text-warning",
    decorative: "bg-warning",
  },
  error: {
    iconBg: "bg-error/10",
    iconText: "text-error",
    decorative: "bg-error",
  },
} as const

export function BookingOverview({ stats, className }: BookingOverviewProps) {
  const { t } = useLocale()

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {items.map((item) => {
        const colors = colorMap[item.color]
        const value = stats[item.statField]
        return (
          <Card key={item.key} className="card-lift relative p-5">
            {/* Decorative circle */}
            <div
              className={cn(
                "absolute -top-5 -end-5 size-20 rounded-full opacity-[0.06]",
                colors.decorative
              )}
            />

            {/* Top row: icon + trend */}
            <div className="flex items-center justify-between mb-3">
              <div
                className={cn(
                  "flex size-10 items-center justify-center rounded-md",
                  colors.iconBg
                )}
              >
                <HugeiconsIcon
                  icon={item.icon}
                  size={20}
                  className={colors.iconText}
                />
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold font-numeric",
                  item.trendUp
                    ? "bg-success/10 text-success"
                    : "bg-error/10 text-error"
                )}
              >
                {item.trendUp ? "↑" : "↓"}
                {item.trend}%
              </span>
            </div>

            {/* Value */}
            <p className="text-4xl font-bold font-numeric leading-none tracking-tight text-foreground">
              {value}
            </p>

            {/* Label */}
            <p className="mt-1 text-[13px] text-muted-foreground">
              {t(item.titleKey)}
            </p>
          </Card>
        )
      })}
    </div>
  )
}
