"use client"

import Link from "next/link"
import { useLocale } from "@/components/locale-provider"
import { HugeiconsIcon } from "@hugeicons/react"
import { Card, CardContent } from "@carekit/ui"
import { cn } from "@/lib/utils"
import type { IconSvgElement } from "@hugeicons/react"

export interface AlertItem {
  id: string
  titleKey: string
  descriptionKey: string
  icon: IconSvgElement
  severity: "warning" | "error" | "info"
  count: number
  href: string
}

interface AttentionAlertsProps {
  alerts: AlertItem[]
}

const severityMap: Record<AlertItem["severity"], string> = {
  warning: "bg-warning/10 text-warning border-warning/20",
  error: "bg-error/10 text-error border-error/20",
  info: "bg-primary/10 text-primary border-primary/20",
}

const iconMap: Record<AlertItem["severity"], string> = {
  warning: "bg-warning/15 text-warning",
  error: "bg-error/15 text-error",
  info: "bg-primary/15 text-primary",
}

export function AttentionAlerts({ alerts }: AttentionAlertsProps) {
  const { t } = useLocale()

  if (alerts.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {alerts.map((alert) => (
        <Link key={alert.id} href={alert.href}>
          <Card className={cn("card-lift cursor-pointer border", severityMap[alert.severity])}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", iconMap[alert.severity])}>
                <HugeiconsIcon icon={alert.icon} size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {t(alert.titleKey)}
                  <span className="ms-1.5 rounded-full bg-current/15 px-1.5 py-0.5 text-xs">{alert.count}</span>
                </p>
                <p className="truncate text-xs opacity-80">{t(alert.descriptionKey)}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
