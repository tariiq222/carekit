"use client"

import { useLocale } from "@/components/locale-provider"
import { useGroupsMutations } from "@/hooks/use-groups-mutations"
import { PageHeader } from "@/components/features/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Cancel01Icon, Calendar03Icon } from "@hugeicons/core-free-icons"
import type { Group } from "@/lib/types/groups"

const statusStyles: Record<string, string> = {
  open: "bg-primary/10 text-primary border-primary/30",
  awaiting_payment: "bg-warning/10 text-warning border-warning/30",
  confirmed: "bg-success/10 text-success border-success/30",
  full: "bg-warning/10 text-warning border-warning/30",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
}

const statusLabels: Record<string, { ar: string; en: string }> = {
  open: { ar: "مفتوح", en: "Open" },
  awaiting_payment: { ar: "بانتظار الدفع", en: "Awaiting Payment" },
  confirmed: { ar: "مؤكد", en: "Confirmed" },
  full: { ar: "مكتمل", en: "Full" },
  completed: { ar: "منتهي", en: "Completed" },
  cancelled: { ar: "ملغي", en: "Cancelled" },
}

interface Props {
  group: Group
  onEnrollClick: () => void
  onSetDateClick: () => void
}

export function GroupDetailHeader({ group, onEnrollClick, onSetDateClick }: Props) {
  const { t, locale } = useLocale()
  const { cancelGroupMut } = useGroupsMutations()

  const name = locale === "ar" ? group.nameAr : group.nameEn
  const practitioner = group.practitioner?.nameAr ?? ""

  const dateDisplay = group.startTime
    ? new Date(group.startTime).toLocaleDateString(
        locale === "ar" ? "ar-SA" : "en-US",
        { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
      )
    : (locale === "ar" ? "بانتظار تحديد التاريخ" : "Date pending")

  const enrollments = group.enrollments ?? []
  const confirmed = enrollments.filter((e) => e.status === "confirmed").length
  const awaiting = enrollments.filter((e) => e.status === "registered").length
  const canAct = group.status !== "completed" && group.status !== "cancelled"
  const needsDate = group.schedulingMode === "on_capacity" && !group.startTime
  const statusLabel = statusLabels[group.status]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={name} description={`${practitioner} — ${dateDisplay}`}>
        {canAct && (
          <>
            {needsDate && group.currentEnrollment >= group.minParticipants && (
              <Button variant="outline" className="gap-2 rounded-full px-5" onClick={onSetDateClick}>
                <HugeiconsIcon icon={Calendar03Icon} size={16} />
                {t("groups.setDate")}
              </Button>
            )}
            <Button variant="outline" className="gap-2 rounded-full px-5" onClick={onEnrollClick}>
              <HugeiconsIcon icon={Add01Icon} size={16} />
              {t("groups.addPatient")}
            </Button>
            <Button
              variant="outline"
              className="gap-2 rounded-full px-5 text-destructive"
              onClick={() => cancelGroupMut.mutate(group.id)}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={16} />
              {t("groups.cancelGroup")}
            </Button>
          </>
        )}
      </PageHeader>

      <div className="flex flex-wrap gap-3 text-sm">
        <Badge className={statusStyles[group.status]}>
          {locale === "ar" ? statusLabel?.ar : statusLabel?.en}
        </Badge>
        <span className="text-muted-foreground">
          {group.currentEnrollment}/{group.maxParticipants} {locale === "ar" ? "مسجل" : "enrolled"}
        </span>
        <span className="text-muted-foreground">
          {confirmed} {locale === "ar" ? "مؤكد" : "confirmed"} · {awaiting} {locale === "ar" ? "بانتظار الدفع" : "awaiting"}
        </span>
        <span className="text-muted-foreground">
          {group.pricePerPersonHalalat === 0
            ? (locale === "ar" ? "مجاني" : "Free")
            : `${(group.pricePerPersonHalalat / 100).toFixed(2)} ${locale === "ar" ? "ر.س" : "SAR"}`}
        </span>
      </div>
    </div>
  )
}
