"use client"

import { useLocale } from "@/components/locale-provider"
import { useGroupsMutations } from "@/hooks/use-groups-mutations"
import { DataTable } from "@/components/features/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon, Certificate01Icon, Mail01Icon, CheckmarkCircle01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import type { ColumnDef } from "@tanstack/react-table"
import type { GroupEnrollment, GroupEnrollmentStatus } from "@/lib/types/groups"

const enrollmentStatusStyles: Record<GroupEnrollmentStatus, string> = {
  registered: "bg-primary/10 text-primary border-primary/30",
  payment_requested: "bg-warning/10 text-warning border-warning/30",
  confirmed: "bg-success/10 text-success border-success/30",
  attended: "bg-success/20 text-success border-success/40",
  expired: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
}

const enrollmentStatusLabels: Record<GroupEnrollmentStatus, { ar: string; en: string }> = {
  registered: { ar: "مسجل", en: "Registered" },
  payment_requested: { ar: "طُلب الدفع", en: "Payment Requested" },
  confirmed: { ar: "مؤكد", en: "Confirmed" },
  attended: { ar: "حضر", en: "Attended" },
  expired: { ar: "منتهي", en: "Expired" },
  cancelled: { ar: "ملغي", en: "Cancelled" },
}

interface Props {
  enrollments: GroupEnrollment[]
  groupId: string
}

export function GroupEnrollmentsTable({ enrollments, groupId }: Props) {
  const { t, locale } = useLocale()
  const { removeEnrollmentMut, issueCertificateMut, resendPaymentMut, confirmAttendanceMut } = useGroupsMutations()

  const columns: ColumnDef<GroupEnrollment>[] = [
    {
      accessorKey: "patient",
      header: t("groups.patient"),
      cell: ({ row }) => {
        const p = row.original.patient
        return p ? `${p.firstName} ${p.lastName}` : "—"
      },
    },
    {
      accessorKey: "status",
      header: t("groups.enrollmentStatus"),
      cell: ({ row }) => {
        const s = row.original.status
        const label = locale === "ar" ? enrollmentStatusLabels[s].ar : enrollmentStatusLabels[s].en
        return <Badge className={enrollmentStatusStyles[s]}>{label}</Badge>
      },
    },
    {
      accessorKey: "attended",
      header: t("groups.attendance"),
      cell: ({ row }) => {
        const attended = row.original.attended
        return (
          <Badge className={attended ? "bg-success/10 text-success border-success/30" : "bg-muted text-muted-foreground"}>
            {attended ? (locale === "ar" ? "حضر" : "Attended") : (locale === "ar" ? "غائب" : "Absent")}
          </Badge>
        )
      },
    },
    {
      accessorKey: "payment",
      header: t("groups.paymentStatus"),
      cell: ({ row }) => row.original.payment?.status ?? "—",
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const canRemove = row.original.status === "registered"
        const canIssueCert = row.original.attended && row.original.status === "attended"
        return (
          <div className="flex items-center gap-1">
            {canIssueCert && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-sm text-success"
                    onClick={() => issueCertificateMut.mutate({ groupId, enrollmentId: row.original.id })}
                  >
                    <HugeiconsIcon icon={Certificate01Icon} size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("groups.issueCertificate")}</TooltipContent>
              </Tooltip>
            )}
            {canRemove && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-sm text-destructive"
                    onClick={() => removeEnrollmentMut.mutate({ groupId, enrollmentId: row.original.id })}
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("groups.removePatient")}</TooltipContent>
              </Tooltip>
            )}
            {row.original.status === 'payment_requested' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-sm text-warning"
                    onClick={() => resendPaymentMut.mutate({ groupId, enrollmentId: row.original.id })}
                    disabled={resendPaymentMut.isPending}
                  >
                    <HugeiconsIcon icon={Mail01Icon} size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("groups.resendPayment")}</TooltipContent>
              </Tooltip>
            )}
            {(row.original.status === 'confirmed' || row.original.status === 'attended') && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`size-9 rounded-sm ${row.original.attended ? 'text-success' : 'text-muted-foreground'}`}
                    onClick={() => confirmAttendanceMut.mutate({
                      groupId,
                      enrollmentId: row.original.id,
                      attended: !row.original.attended,
                    })}
                    disabled={confirmAttendanceMut.isPending}
                  >
                    <HugeiconsIcon icon={row.original.attended ? Cancel01Icon : CheckmarkCircle01Icon} size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {row.original.attended ? t("groups.markAbsent") : t("groups.markAttended")}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={enrollments}
      emptyTitle={t("groups.noEnrollments")}
      emptyDescription={t("groups.noEnrollmentsDesc")}
    />
  )
}
