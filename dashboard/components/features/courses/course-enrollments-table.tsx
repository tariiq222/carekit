"use client"

import { useLocale } from "@/components/locale-provider"
import { useCoursesMutations } from "@/hooks/use-courses-mutations"
import { DataTable } from "@/components/features/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon, MoneyReceive01Icon } from "@hugeicons/core-free-icons"
import type { ColumnDef } from "@tanstack/react-table"
import type { CourseEnrollment, CourseEnrollmentStatus } from "@/lib/types/courses"

const enrollmentStatusStyles: Record<CourseEnrollmentStatus, string> = {
  enrolled: "bg-primary/10 text-primary border-primary/30",
  active: "bg-success/10 text-success border-success/30",
  completed: "bg-success/20 text-success border-success/40",
  dropped: "bg-muted text-muted-foreground",
  refunded: "bg-warning/10 text-warning border-warning/30",
}

interface Props {
  enrollments: CourseEnrollment[]
  courseId: string
}

export function CourseEnrollmentsTable({ enrollments, courseId }: Props) {
  const { t, locale } = useLocale()
  const { dropEnrollmentMut, refundEnrollmentMut } = useCoursesMutations()

  const columns: ColumnDef<CourseEnrollment>[] = [
    {
      accessorKey: "patient",
      header: t("courses.patient"),
      cell: ({ row }) => {
        const p = row.original.patient
        return p ? `${p.firstName} ${p.lastName}` : "—"
      },
    },
    {
      accessorKey: "status",
      header: t("courses.enrollmentStatus"),
      cell: ({ row }) => {
        const s = row.original.status
        return (
          <Badge className={enrollmentStatusStyles[s]}>
            {t(`courses.enrollmentStatus.${s}`)}
          </Badge>
        )
      },
    },
    {
      accessorKey: "sessionsAttended",
      header: t("courses.attendedSessions"),
      cell: ({ row }) => row.original.sessionsAttended,
    },
    {
      accessorKey: "payment",
      header: t("courses.paymentStatus"),
      cell: ({ row }) => row.original.payment?.status ?? "—",
    },
    {
      accessorKey: "enrolledAt",
      header: t("courses.enrolledAt"),
      cell: ({ row }) =>
        new Date(row.original.enrolledAt).toLocaleDateString(
          locale === "ar" ? "ar-SA" : "en-US",
          { year: "numeric", month: "short", day: "numeric" },
        ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const { status, id } = row.original
        const canDrop = status === "enrolled" || status === "active"
        const canRefund = status === "dropped" && !!row.original.payment
        return (
          <div className="flex items-center gap-1">
            {canDrop && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="icon"
                    className="size-9 rounded-sm text-destructive"
                    onClick={() => dropEnrollmentMut.mutate({ courseId, enrollmentId: id })}
                    disabled={dropEnrollmentMut.isPending}
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("courses.dropEnrollment")}</TooltipContent>
              </Tooltip>
            )}
            {canRefund && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="icon"
                    className="size-9 rounded-sm"
                    onClick={() => refundEnrollmentMut.mutate({ courseId, enrollmentId: id })}
                    disabled={refundEnrollmentMut.isPending}
                  >
                    <HugeiconsIcon icon={MoneyReceive01Icon} size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("courses.refundEnrollment")}</TooltipContent>
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
      emptyTitle={t("courses.noEnrollments")}
      emptyDescription={t("courses.noEnrollmentsDesc")}
    />
  )
}
