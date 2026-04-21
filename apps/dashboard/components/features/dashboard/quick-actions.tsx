"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Calendar03Icon,
  UserAdd01Icon,
  Clock01Icon,
  AnalyticsUpIcon,
} from "@hugeicons/core-free-icons"
import { Card } from "@carekit/ui"
import { useLocale } from "@/components/locale-provider"

const actions = [
  { titleKey: "actions.newBooking", icon: Calendar03Icon, href: "/bookings", color: "primary" as const },
  { titleKey: "actions.addClient", icon: UserAdd01Icon, href: "/clients", color: "success" as const },
  { titleKey: "actions.viewCalendar", icon: Clock01Icon, href: "/bookings", color: "warning" as const },
  { titleKey: "actions.reports", icon: AnalyticsUpIcon, href: "/reports", color: "info" as const },
]

const colorMap = {
  primary: "bg-primary/8 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
} as const

export function QuickActions() {
  const { t } = useLocale()

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {actions.map((action) => (
        <Link key={action.titleKey} href={action.href}>
          <Card className="card-lift group flex items-center gap-3 px-5 py-3">
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full",
                colorMap[action.color]
              )}
            >
              <HugeiconsIcon icon={action.icon} size={18} />
            </div>
            <span className="text-sm font-medium text-foreground">
              {t(action.titleKey)}
            </span>
          </Card>
        </Link>
      ))}
    </div>
  )
}
