"use client"

import { Card, Skeleton } from "@carekit/ui"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"
import type { Subscription } from "@/lib/types/billing"

/* ─── Metric definitions ─── */

interface MetricDef {
  key: string
  labelAr: string
  labelEn: string
}

const METRICS: MetricDef[] = [
  { key: "branches",       labelAr: "الفروع",          labelEn: "Branches"          },
  { key: "employees",      labelAr: "الموظفون",         labelEn: "Employees"         },
  { key: "bookingsPerMonth", labelAr: "الحجوزات / شهر", labelEn: "Bookings / month"  },
  { key: "clients",        labelAr: "العملاء",          labelEn: "Clients"           },
  { key: "storage",        labelAr: "التخزين (GB)",     labelEn: "Storage (GB)"      },
]

/* ─── Single bar ─── */

interface UsageBarProps {
  label: string
  used: number
  max: number | boolean
}

function UsageBar({ label, used, max }: UsageBarProps) {
  const { locale } = useLocale()
  const isAr = locale === "ar"

  if (typeof max === "boolean" || max === 0) {
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="text-foreground font-medium">
            {max === true
              ? (isAr ? "غير محدود" : "Unlimited")
              : (isAr ? "غير متاح" : "Not available")}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted" />
      </div>
    )
  }

  const pct = Math.min(Math.round((used / max) * 100), 100)
  const barColor =
    pct >= 90 ? "bg-destructive" :
    pct >= 75 ? "bg-warning" :
    "bg-primary"

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-medium tabular-nums">
          {used} / {max}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/* ─── Main component ─── */

interface UsageBarsProps {
  subscription?: Subscription | null
  isLoading: boolean
}

export function UsageBars({ subscription, isLoading }: UsageBarsProps) {
  const { locale } = useLocale()
  const isAr = locale === "ar"

  if (isLoading) {
    return (
      <Card className="p-6 space-y-5">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </Card>
    )
  }

  const limits = subscription?.plan.limits ?? {}

  return (
    <Card className="p-6 space-y-5">
      <h3 className="text-base font-semibold text-foreground">
        {isAr ? "حدود الاستخدام" : "Usage limits"}
      </h3>

      {METRICS.map((metric) => {
        const max = limits[metric.key] ?? false
        const label = isAr ? metric.labelAr : metric.labelEn
        return (
          <UsageBar
            key={metric.key}
            label={label}
            used={0}
            max={max as number | boolean}
          />
        )
      })}

      {!subscription && (
        <p className="text-sm text-muted-foreground">
          {isAr ? "لا يوجد اشتراك نشط." : "No active subscription."}
        </p>
      )}
    </Card>
  )
}
