"use client"

import { useLocale } from "@/components/locale-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@carekit/ui"
import { cn } from "@/lib/utils"

export interface ActivityItem {
  id: string
  type: "booking" | "payment" | "cancellation" | "registration" | "rating"
  messageKey: string
  timeAgo: string
  initials: string
}

interface ActivityFeedProps {
  items: ActivityItem[]
  className?: string
}

const typeColors: Record<ActivityItem["type"], string> = {
  booking: "bg-primary/10 text-primary",
  payment: "bg-success/10 text-success",
  cancellation: "bg-error/10 text-error",
  registration: "bg-accent/10 text-accent-foreground",
  rating: "bg-warning/10 text-warning",
}

export function ActivityFeed({ items, className }: ActivityFeedProps) {
  const { t } = useLocale()

  return (
    <Card className={cn("card-lift", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("dashboard.recentActivity")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                typeColors[item.type]
              )}
            >
              {item.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{t(item.messageKey)}</p>
              <p className="text-xs text-muted-foreground">{item.timeAgo}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
