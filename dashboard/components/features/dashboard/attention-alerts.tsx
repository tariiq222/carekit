"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  InvoiceIcon,
  CancelCircleIcon,
  Alert02Icon,
} from "@hugeicons/core-free-icons"
import { useLocale } from "@/components/locale-provider"

interface AttentionAlertsProps {
  pendingPayments: number
  cancelRequests: number
  problemReports: number
}

const alerts = [
  {
    key: "payments",
    titleAr: "مدفوعات معلقة",
    titleEn: "Pending Payments",
    descAr: "تحويلات بنكية بانتظار المراجعة",
    descEn: "Bank transfers awaiting review",
    icon: InvoiceIcon,
    severity: "warning" as const,
    href: "/payments",
    countKey: "pendingPayments" as const,
  },
  {
    key: "cancel",
    titleAr: "طلبات إلغاء",
    titleEn: "Cancellation Requests",
    descAr: "مرضى يطلبون إلغاء حجوزاتهم",
    descEn: "Patients requesting cancellation",
    icon: CancelCircleIcon,
    severity: "error" as const,
    href: "/bookings",
    countKey: "cancelRequests" as const,
  },
  {
    key: "reports",
    titleAr: "بلاغات مرضى",
    titleEn: "Problem Reports",
    descAr: "بلاغات جديدة من المرضى",
    descEn: "New reports from patients",
    icon: Alert02Icon,
    severity: "info" as const,
    href: "/bookings?tab=problemReports",
    countKey: "problemReports" as const,
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
  const { locale } = useLocale()

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
                    {locale === "ar" ? alert.titleAr : alert.titleEn}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {locale === "ar" ? alert.descAr : alert.descEn}
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
