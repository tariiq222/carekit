"use client"

import { useLocale } from "@/components/locale-provider"
import { useGroupSessionsMutations } from "@/hooks/use-group-sessions-mutations"
import { DataTable } from "@/components/features/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon } from "@hugeicons/core-free-icons"
import type { ColumnDef } from "@tanstack/react-table"
import type { GroupEnrollment, GroupEnrollmentStatus } from "@/lib/types/group-sessions"

const enrollmentStatusStyles: Record<GroupEnrollmentStatus, string> = {
  registered: "bg-primary/10 text-primary border-primary/30",
  confirmed: "bg-success/10 text-success border-success/30",
  attended: "bg-success/20 text-success border-success/40",
  expired: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
}

const enrollmentStatusLabels: Record<GroupEnrollmentStatus, { ar: string; en: string }> = {
  registered: { ar: "مسجل", en: "Registered" },
  confirmed: { ar: "مؤكد", en: "Confirmed" },
  attended: { ar: "حضر", en: "Attended" },
  expired: { ar: "منتهي", en: "Expired" },
  cancelled: { ar: "ملغي", en: "Cancelled" },
}

interface Props {
  enrollments: GroupEnrollment[]
  sessionId: string
}

export function EnrollmentsTable({ enrollments, sessionId }: Props) {
  const { t, locale } = useLocale()
  const { removeEnrollmentMut } = useGroupSessionsMutations()

  const columns: ColumnDef<GroupEnrollment>[] = [
    {
      accessorKey: "patient",
      header: t("groupSessions.patient"),
      cell: ({ row }) => {
        const p = row.original.patient
        return p ? `${p.firstName} ${p.lastName}` : "—"
      },
    },
    {
      accessorKey: "status",
      header: t("groupSessions.enrollmentStatus"),
      cell: ({ row }) => {
        const s = row.original.status
        const label = locale === "ar" ? enrollmentStatusLabels[s].ar : enrollmentStatusLabels[s].en
        return <Badge className={enrollmentStatusStyles[s]}>{label}</Badge>
      },
    },
    {
      accessorKey: "payment",
      header: t("groupSessions.paymentStatus"),
      cell: ({ row }) => row.original.payment?.status ?? "—",
    },
    {
      accessorKey: "paymentDeadlineAt",
      header: t("groupSessions.paymentDeadline"),
      cell: ({ row }) => {
        const d = row.original.paymentDeadlineAt
        if (!d) return "—"
        return new Date(d).toLocaleDateString(
          locale === "ar" ? "ar-SA" : "en-US",
          { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
        )
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const canRemove = row.original.status === "registered"
        if (!canRemove) return null
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-sm text-destructive"
                onClick={() => removeEnrollmentMut.mutate({
                  sessionId,
                  enrollmentId: row.original.id,
                })}
              >
                <HugeiconsIcon icon={Delete02Icon} size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("groupSessions.removePatient")}</TooltipContent>
          </Tooltip>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={enrollments}
      emptyTitle={t("groupSessions.noEnrollments")}
      emptyDescription={t("groupSessions.noEnrollmentsDesc")}
    />
  )
}
