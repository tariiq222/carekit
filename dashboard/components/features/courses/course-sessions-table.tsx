"use client"

import { useLocale } from "@/components/locale-provider"
import { DataTable } from "@/components/features/data-table"
import { Badge } from "@/components/ui/badge"
import type { ColumnDef } from "@tanstack/react-table"
import type { CourseSession, CourseSessionStatus } from "@/lib/types/courses"

const sessionStatusStyles: Record<CourseSessionStatus, string> = {
  scheduled: "bg-primary/10 text-primary border-primary/30",
  completed: "bg-success/10 text-success border-success/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
}

interface Props {
  sessions: CourseSession[]
  onMarkAttendance?: (session: CourseSession) => void
}

export function CourseSessionsTable({ sessions }: Props) {
  const { t, locale } = useLocale()

  const columns: ColumnDef<CourseSession>[] = [
    {
      accessorKey: "sessionNumber",
      header: t("courses.sessionNumber"),
      cell: ({ row }) => `#${row.original.sessionNumber}`,
    },
    {
      accessorKey: "title",
      header: t("courses.name"),
      cell: ({ row }) => {
        const titleAr = row.original.titleAr
        const titleEn = row.original.titleEn
        const title = locale === "ar" ? titleAr : titleEn
        return title ?? "—"
      },
    },
    {
      accessorKey: "scheduledAt",
      header: t("courses.scheduledAt"),
      cell: ({ row }) =>
        new Date(row.original.scheduledAt).toLocaleDateString(
          locale === "ar" ? "ar-SA" : "en-US",
          { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
        ),
    },
    {
      accessorKey: "status",
      header: t("courses.sessionStatus"),
      cell: ({ row }) => {
        const s = row.original.status
        return (
          <Badge className={sessionStatusStyles[s]}>
            {t(`courses.sessionStatus.${s}`)}
          </Badge>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={sessions}
      emptyTitle={t("courses.noSessions")}
    />
  )
}
