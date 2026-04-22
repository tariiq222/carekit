"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  InvoiceIcon,
  CancelCircleIcon,
} from "@hugeicons/core-free-icons"
import { useLocale } from "@/components/locale-provider"

interface AttentionAlertsProps {
  pendingPayments: number
  cancelRequests: number
}

const alerts = [
  {
    key: "payments",
    titleKey: "alerts.pendingPayments",
    descKey: "alerts.pendingPaymentsDesc",
    icon: InvoiceIcon,
    severity: "warning" as const,
    href: "/payments",
    countKey: "pendingPayments" as const,
  },
  {
    key: "cancel",
    titleKey: "alerts.cancelRequests",
    descKey: "alerts.cancelRequestsDesc",
    icon: CancelCircleIcon,
    severity: "error" as const,
    href: "/bookings",
    countKey: "cancelRequests" as const,
  },
]

const severityStyles = {
  warning: {
    iconBg: "bg-warning/10",
    iconText: "text-warning",
    border: "border-s-warning",
  },
  error: {
    iconBg: "bg-error/10",
    iconText: "text-error",
    border: "border-s-error",
  },
  info: {
    iconBg: "bg-info/10",
    iconText: "text-info",
    border: "border-s-info",
  },
} as const

export function AttentionAlerts(props: AttentionAlertsProps) {
  const { t } = useLocale()

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {alerts.map((alert) => {
        const styles = severityStyles[alert.severity]
        const count = props[alert.countKey]

        return (
          <div key={alert.key}>
            <Link href={alert.href}>
              <div
                className={cn(
                  "glass relative flex items-center gap-3.5 overflow-hidden rounded-xl border-s-[3px] p-4",
                  styles.border
                )}
              >
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full",
                    styles.iconBg
                  )}
                >
                  <HugeiconsIcon icon={alert.icon} size={20} className={styles.iconText} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {count > 0 && (
                      <span className="tabular-nums" style={{ display: "inline-block" }}>
                        {count}{" "}
                      </span>
                    )}
                    {t(alert.titleKey)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t(alert.descKey)}
                  </p>
                </div>
              </div>
            </Link>
          </div>
        )
      })}
    </div>
  )
}
